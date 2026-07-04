import crypto from 'node:crypto';
import { z } from 'zod';
import { db } from '../db.js';

// Processamento de leads do Chaves na Mão.
//
// Mesmo contrato de robustez do Canal Pro: o endpoint responde 2xx na hora,
// este módulo roda assíncrono, upsert idempotente, e payload incompleto vai
// para a fila de revisão (error_leads) em vez de ser descartado.
//
// O Chaves na Mão não publica um schema único de webhook — o formato varia
// conforme o parceiro de integração. Este parser aceita os nomes de campo
// mais comuns em PT e EN (nome/name, telefone/phone, mensagem/message etc.).
// Ajuste o schema abaixo quando tiver o payload real da sua conta.

const SIGNATURE_FIELDS = [
  'nome', 'name', 'telefone', 'phone', 'email', 'mensagem', 'message',
  'codigoImovel', 'imovel', 'referencia', 'leadId', 'id', 'origem', 'portal',
];

export function looksLikeChavesNaMao(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false;
  const hits = SIGNATURE_FIELDS.filter((f) => f in body).length;
  const hasContactShape = ('nome' in body || 'name' in body) ||
    ('telefone' in body || 'phone' in body || 'email' in body);
  return hits >= 2 && hasContactShape;
}

const schema = z
  .object({
    id: z.union([z.string(), z.number()]).nullish(),
    leadId: z.union([z.string(), z.number()]).nullish(),
    nome: z.string().nullish(),
    name: z.string().nullish(),
    email: z.string().nullish(),
    telefone: z.union([z.string(), z.number()]).nullish(),
    phone: z.union([z.string(), z.number()]).nullish(),
    mensagem: z.string().nullish(),
    message: z.string().nullish(),
    codigoImovel: z.union([z.string(), z.number()]).nullish(),
    imovel: z.union([z.string(), z.number()]).nullish(),
    referencia: z.union([z.string(), z.number()]).nullish(),
    origem: z.string().nullish(),
    portal: z.string().nullish(),
    data: z.string().nullish(),
    timestamp: z.string().nullish(),
  })
  .passthrough()
  .refine((d) => (d.nome ?? d.name ?? '').trim().length > 0, {
    message: 'nome (ou name) é obrigatório',
  })
  .refine((d) => d.telefone != null || d.phone != null || d.email != null, {
    message: 'é preciso ao menos telefone ou email',
  });

// Idempotência: usa o id do lead quando o portal envia; sem id, deriva uma
// chave determinística do conteúdo — reenvios idênticos viram UPDATE.
function originKey(d) {
  const id = d.leadId ?? d.id;
  if (id != null) return `cnm:${id}`;
  const hash = crypto
    .createHash('sha1')
    .update(['cnm', d.nome ?? d.name, d.email, d.telefone ?? d.phone, d.codigoImovel ?? d.imovel ?? d.referencia, d.data ?? d.timestamp].join('|'))
    .digest('hex')
    .slice(0, 20);
  return `cnm:h:${hash}`;
}

const upsertLead = db.prepare(`
  INSERT INTO leads (
    name, email, phone, source, origin_lead_id, origin_listing_id, message, stage
  ) VALUES (
    @name, @email, @phone, 'chaves-na-mao', @origin_lead_id, @origin_listing_id, @message, 'novo_lead'
  )
  ON CONFLICT(origin_lead_id) DO UPDATE SET
    name = excluded.name,
    email = COALESCE(excluded.email, leads.email),
    phone = COALESCE(excluded.phone, leads.phone),
    message = COALESCE(excluded.message, leads.message),
    updated_at = datetime('now')
`);

const findByOrigin = db.prepare('SELECT id FROM leads WHERE origin_lead_id = ?');
const insertInteraction = db.prepare('INSERT INTO interactions (lead_id, type, note) VALUES (?, ?, ?)');
const updateLog = db.prepare('UPDATE webhook_logs SET status = ?, error = ? WHERE id = ?');
const insertErrorLead = db.prepare('INSERT INTO error_leads (payload, reason, source) VALUES (?, ?, ?)');

const processTx = db.transaction((data) => {
  const key = originKey(data);
  const existedBefore = findByOrigin.get(key);
  const phone = data.telefone ?? data.phone;
  upsertLead.run({
    name: (data.nome ?? data.name).trim(),
    email: data.email ?? null,
    phone: phone != null ? String(phone) : null,
    origin_lead_id: key,
    origin_listing_id:
      data.codigoImovel ?? data.imovel ?? data.referencia
        ? String(data.codigoImovel ?? data.imovel ?? data.referencia)
        : null,
    message: data.mensagem ?? data.message ?? null,
  });
  const lead = findByOrigin.get(key);
  const msg = data.mensagem ?? data.message;
  insertInteraction.run(
    lead.id,
    'lead_recebido',
    existedBefore
      ? 'Novo evento via Chaves na Mão'
      : `Lead recebido via Chaves na Mão${msg ? ` — "${msg}"` : ''}`
  );
  return { leadId: lead.id, updated: Boolean(existedBefore) };
});

export function processChavesNaMaoLead(rawBody, logId) {
  try {
    const parsed = schema.safeParse(rawBody);
    if (!parsed.success) {
      const reason = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`)
        .join('; ');
      insertErrorLead.run(JSON.stringify(rawBody), reason, 'chaves-na-mao');
      updateLog.run('error_lead', reason, logId);
      return;
    }
    const result = processTx(parsed.data);
    updateLog.run(result.updated ? 'processed_update' : 'processed_new', null, logId);
  } catch (err) {
    console.error('[chaves-na-mao] falha ao processar lead:', err);
    try {
      insertErrorLead.run(JSON.stringify(rawBody), `Erro interno: ${err.message}`, 'chaves-na-mao');
      updateLog.run('failed', err.message, logId);
    } catch (inner) {
      console.error('[chaves-na-mao] falha ao registrar erro:', inner);
    }
  }
}
