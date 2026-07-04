import { Router } from 'express';
import { z } from 'zod';
import { db, setSetting } from '../db.js';
import { encrypt } from '../crypto.js';
import { syncProperties, getTecimobStatus, hasApiKey, TecimobError } from '../services/tecimob.js';

const router = Router();

// A chave da Tecimob é write-only: entra pelo POST, é criptografada (AES-256-GCM)
// e nunca volta ao frontend — o GET informa apenas SE existe chave configurada.
router.get('/', (_req, res) => {
  res.json({ tecimobKeyConfigured: hasApiKey() });
});

router.post('/tecimob-key', (req, res) => {
  const parsed = z.object({ apiKey: z.string().min(8) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Informe uma chave de API válida.' });
  }
  setSetting('tecimob_api_key', encrypt(parsed.data.apiKey.trim()));
  setSetting('tecimob_status', JSON.stringify({})); // zera erros anteriores
  res.json({ ok: true });
});

router.delete('/tecimob-key', (_req, res) => {
  db.prepare('DELETE FROM settings WHERE key IN (?, ?)').run('tecimob_api_key', 'tecimob_status');
  res.status(204).end();
});

// ---- Integrações ----

router.post('/integrations/tecimob/sync', async (_req, res) => {
  try {
    const result = await syncProperties();
    res.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof TecimobError) {
      // Mapeia o erro para algo acionável no frontend; a aplicação nunca quebra.
      const statusByCode = { auth: 401, no_key: 400, rate_limit: 429, timeout: 504, server: 502, network: 502 };
      return res.status(statusByCode[err.code] ?? 500).json({ error: err.message, code: err.code });
    }
    console.error('[tecimob] erro inesperado no sync:', err);
    res.status(500).json({ error: 'Erro inesperado na sincronização.', code: 'unknown' });
  }
});

router.get('/integrations/status', (_req, res) => {
  const canalPro24h = db.prepare(`
    SELECT COUNT(*) AS n FROM leads
    WHERE source = 'canal-pro' AND created_at >= datetime('now', '-1 day')
  `).get().n;

  const pendingErrors = db.prepare('SELECT COUNT(*) AS n FROM error_leads WHERE reviewed = 0').get().n;

  const lastWebhook = db.prepare(`
    SELECT received_at FROM webhook_logs WHERE source = 'canal-pro' ORDER BY id DESC LIMIT 1
  `).get();

  res.json({
    tecimob: getTecimobStatus(),
    canalPro: {
      leadsLast24h: canalPro24h,
      lastWebhookAt: lastWebhook?.received_at ?? null,
      pendingErrors,
    },
  });
});

// Leads com erro (payloads do Canal Pro que falharam na validação completa)
router.get('/integrations/error-leads', (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM error_leads WHERE reviewed = 0 ORDER BY received_at DESC LIMIT 100')
    .all()
    .map((r) => ({ ...r, payload: JSON.parse(r.payload) }));
  res.json(rows);
});

router.post('/integrations/error-leads/:id/review', (req, res) => {
  db.prepare('UPDATE error_leads SET reviewed = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
