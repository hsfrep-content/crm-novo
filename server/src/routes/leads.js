import { Router } from 'express';
import { z } from 'zod';
import { db, STAGES, touchLead } from '../db.js';

const router = Router();

const leadInput = z.object({
  name: z.string().min(1),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  whatsapp: z.string().nullish(),
  source: z.string().optional(),
  stage: z.enum(STAGES).optional(),
  message: z.string().nullish(),
  interest_neighborhood: z.string().nullish(),
  interest_type: z.string().nullish(),
  interest_price_min: z.number().int().nullish(),
  interest_price_max: z.number().int().nullish(),
  tags: z.array(z.string()).optional(),
});

function serialize(row) {
  return { ...row, tags: JSON.parse(row.tags || '[]') };
}

const overdueCount = db.prepare(`
  SELECT COUNT(*) AS n FROM tasks
  WHERE lead_id = ? AND done = 0 AND due_at IS NOT NULL AND due_at < datetime('now')
`);

// GET /api/leads?stage=&tag=&source=&q=
router.get('/', (req, res) => {
  const { stage, tag, source, q } = req.query;
  const where = [];
  const params = {};
  if (stage) { where.push('stage = @stage'); params.stage = stage; }
  if (source) { where.push('source = @source'); params.source = source; }
  if (tag) { where.push(`EXISTS (SELECT 1 FROM json_each(leads.tags) WHERE json_each.value = @tag)`); params.tag = tag; }
  if (q) {
    where.push('(name LIKE @q OR email LIKE @q OR phone LIKE @q)');
    params.q = `%${q}%`;
  }
  const sql = `SELECT * FROM leads ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY updated_at DESC`;
  const rows = db.prepare(sql).all(params).map((row) => ({
    ...serialize(row),
    overdue_tasks: overdueCount.get(row.id).n,
  }));
  res.json(rows);
});

// GET /api/leads/export.csv — exportação completa em CSV
router.get('/export.csv', (_req, res) => {
  const rows = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
  const headers = [
    'id', 'nome', 'email', 'telefone', 'whatsapp', 'origem', 'tipo_lead', 'etapa',
    'bairro_interesse', 'tipo_imovel', 'preco_min', 'preco_max', 'tags', 'mensagem',
    'criado_em', 'atualizado_em',
  ];
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const lines = rows.map((r) =>
    [
      r.id, r.name, r.email, r.phone, r.whatsapp, r.source, r.lead_type, r.stage,
      r.interest_neighborhood, r.interest_type, r.interest_price_min, r.interest_price_max,
      JSON.parse(r.tags || '[]').join('|'), r.message, r.created_at, r.updated_at,
    ].map(escape).join(',')
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
  res.send('﻿' + [headers.join(','), ...lines].join('\n'));
});

router.get('/:id', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado.' });
  const tasks = db.prepare('SELECT * FROM tasks WHERE lead_id = ? ORDER BY done, due_at').all(lead.id);
  const interactions = db
    .prepare('SELECT * FROM interactions WHERE lead_id = ? ORDER BY created_at DESC, id DESC')
    .all(lead.id);
  const properties = db
    .prepare(`SELECT p.* FROM properties p JOIN lead_properties lp ON lp.property_id = p.id WHERE lp.lead_id = ?`)
    .all(lead.id);
  res.json({ ...serialize(lead), tasks, interactions, properties });
});

router.post('/', (req, res) => {
  const parsed = leadInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const d = parsed.data;
  const info = db.prepare(`
    INSERT INTO leads (name, email, phone, whatsapp, source, stage, message,
      interest_neighborhood, interest_type, interest_price_min, interest_price_max, tags)
    VALUES (@name, @email, @phone, @whatsapp, @source, @stage, @message,
      @interest_neighborhood, @interest_type, @interest_price_min, @interest_price_max, @tags)
  `).run({
    name: d.name,
    email: d.email ?? null,
    phone: d.phone ?? null,
    whatsapp: d.whatsapp ?? null,
    source: d.source ?? 'manual',
    stage: d.stage ?? 'novo_lead',
    message: d.message ?? null,
    interest_neighborhood: d.interest_neighborhood ?? null,
    interest_type: d.interest_type ?? null,
    interest_price_min: d.interest_price_min ?? null,
    interest_price_max: d.interest_price_max ?? null,
    tags: JSON.stringify(d.tags ?? []),
  });
  res.status(201).json(serialize(db.prepare('SELECT * FROM leads WHERE id = ?').get(info.lastInsertRowid)));
});

router.patch('/:id', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado.' });
  const parsed = leadInput.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const d = parsed.data;

  if (d.stage && d.stage !== lead.stage) {
    db.prepare('INSERT INTO interactions (lead_id, type, note) VALUES (?, ?, ?)').run(
      lead.id, 'mudanca_etapa', `Etapa alterada: ${lead.stage} → ${d.stage}`
    );
  }

  const fields = { ...d };
  if ('tags' in fields) fields.tags = JSON.stringify(fields.tags ?? []);
  const keys = Object.keys(fields);
  if (keys.length) {
    db.prepare(`UPDATE leads SET ${keys.map((k) => `${k} = @${k}`).join(', ')}, updated_at = datetime('now') WHERE id = @id`)
      .run({ ...fields, id: lead.id });
  }
  res.json(serialize(db.prepare('SELECT * FROM leads WHERE id = ?').get(lead.id)));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Lead não encontrado.' });
  res.status(204).end();
});

// ---- Tarefas ----
router.post('/:id/tasks', (req, res) => {
  const parsed = z.object({ title: z.string().min(1), due_at: z.string().nullish() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Título é obrigatório.' });
  const info = db.prepare('INSERT INTO tasks (lead_id, title, due_at) VALUES (?, ?, ?)')
    .run(req.params.id, parsed.data.title, parsed.data.due_at ?? null);
  touchLead(req.params.id);
  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid));
});

router.patch('/:id/tasks/:taskId', (req, res) => {
  const done = req.body.done ? 1 : 0;
  db.prepare('UPDATE tasks SET done = ? WHERE id = ? AND lead_id = ?').run(done, req.params.taskId, req.params.id);
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.taskId));
});

router.delete('/:id/tasks/:taskId', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ? AND lead_id = ?').run(req.params.taskId, req.params.id);
  res.status(204).end();
});

// ---- Interações (timeline) ----
router.post('/:id/interactions', (req, res) => {
  const parsed = z.object({ type: z.string().default('nota'), note: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Nota é obrigatória.' });
  const info = db.prepare('INSERT INTO interactions (lead_id, type, note) VALUES (?, ?, ?)')
    .run(req.params.id, parsed.data.type, parsed.data.note);
  touchLead(req.params.id);
  res.status(201).json(db.prepare('SELECT * FROM interactions WHERE id = ?').get(info.lastInsertRowid));
});

// ---- Vínculo com imóveis ----
router.post('/:id/properties/:propertyId', (req, res) => {
  db.prepare('INSERT OR IGNORE INTO lead_properties (lead_id, property_id) VALUES (?, ?)')
    .run(req.params.id, req.params.propertyId);
  res.status(201).json({ ok: true });
});

router.delete('/:id/properties/:propertyId', (req, res) => {
  db.prepare('DELETE FROM lead_properties WHERE lead_id = ? AND property_id = ?')
    .run(req.params.id, req.params.propertyId);
  res.status(204).end();
});

export default router;
