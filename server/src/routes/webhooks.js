import { Router } from 'express';
import { db } from '../db.js';
import { looksLikeCanalPro, processCanalProLead } from '../services/canalPro.js';
import { looksLikeChavesNaMao, processChavesNaMaoLead } from '../services/chavesNaMao.js';

const router = Router();

const insertLog = db.prepare(
  'INSERT INTO webhook_logs (source, payload, status) VALUES (?, ?, ?)'
);

// POST /webhooks/canal-pro
// Contrato com o Grupo OLX:
//  1. valida apenas a ESTRUTURA (endpoint público — rejeita 400 o que não
//     parece payload do Grupo OLX, contra spam/abuso)
//  2. grava o payload bruto no log de auditoria (retido >= 30 dias)
//  3. responde 200 imediatamente
//  4. processa o lead de forma assíncrona (setImmediate) — validação completa,
//     upsert idempotente por originLeadId e fila de erros ficam fora do caminho
//     da resposta, então o Grupo OLX nunca espera lógica de negócio
router.post('/canal-pro', (req, res) => {
  const body = req.body;

  if (!looksLikeCanalPro(body)) {
    insertLog.run('canal-pro', JSON.stringify(body ?? null), 'rejected_schema');
    return res.status(400).json({ error: 'Payload não corresponde ao formato do Canal Pro.' });
  }

  const { lastInsertRowid: logId } = insertLog.run('canal-pro', JSON.stringify(body), 'received');
  res.status(200).json({ received: true });

  setImmediate(() => processCanalProLead(body, Number(logId)));
});

// POST /webhooks/chaves-na-mao — mesmo contrato do Canal Pro:
// valida estrutura (400 para spam), loga o payload bruto, responde 200 na hora
// e processa assíncrono com upsert idempotente.
router.post('/chaves-na-mao', (req, res) => {
  const body = req.body;

  if (!looksLikeChavesNaMao(body)) {
    insertLog.run('chaves-na-mao', JSON.stringify(body ?? null), 'rejected_schema');
    return res.status(400).json({ error: 'Payload não corresponde ao formato do Chaves na Mão.' });
  }

  const { lastInsertRowid: logId } = insertLog.run('chaves-na-mao', JSON.stringify(body), 'received');
  res.status(200).json({ received: true });

  setImmediate(() => processChavesNaMaoLead(body, Number(logId)));
});

export default router;
