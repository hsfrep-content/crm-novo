import { z } from 'zod';
import { db } from '../db.js';

// Processamento de leads do Canal Pro (Grupo OLX / ZAP / Viva Real).
//
// Contrato do webhook:
//  - o endpoint responde 2xx IMEDIATAMENTE; este módulo roda depois, de forma
//    assíncrona, para nunca deixar o Grupo OLX esperando lógica de negócio
//  - idempotência por originLeadId (o Grupo OLX reenvia até 3x em falha e por
//    até 14 dias se o servidor ficar fora): upsert transacional, nunca insert
//  - payload com estrutura OLX mas campos obrigatórios ausentes vai para a
//    tabela error_leads (revisão manual) em vez de ser descartado

export const LEAD_TYPES = {
  CLICK_SCHEDULE: 'Clique em agendar',
  CLICK_WHATSAPP: 'Clique no WhatsApp',
  CONTACT_CHAT: 'Contato via chat',
  CONTACT_FORM: 'Formulário de contato',
  PHONE_VIEW: 'Visualizou telefone',
  VISIT_REQUEST: 'Pedido de visita',
};

// Schema estrutural frouxo: o endpoint é público, então só aceitamos requisições
// que se pareçam de fato com o payload do Grupo OLX (>= 3 campos de assinatura).
const SIGNATURE_FIELDS = [
  'leadOrigin',
  'originLeadId',
  'originListingId',
  'clientListingId',
  'phoneNumber',
  'ddd',
  'extraData',
  'timestamp',
];

export function looksLikeCanalPro(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false;
  const hits = SIGNATURE_FIELDS.filter((f) => f in body).length;
  return hits >= 3;
}

const fullSchema = z.object({
  leadOrigin: z.string().nullish(),
  timestamp: z.string().nullish(),
  originLeadId: z.string().min(1),
  originListingId: z.union([z.string(), z.number()]).nullish(),
  clientListingId: z.union([z.string(), z.number()]).nullish(),
  name: z.string().min(1),
  email: z.string().nullish(),
  ddd: z.union([z.string(), z.number()]).nullish(),
  phone: z.union([z.string(), z.number()]).nullish(),
  phoneNumber: z.union([z.string(), z.number()]).nullish(),
  message: z.string().nullish(),
  extraData: z.object({ leadType: z.string().nullish() }).passthrough().nullish(),
});

const upsertLead = db.prepare(`
  INSERT INTO leads (
    name, email, phone, whatsapp, source, lead_type,
    origin_lead_id, origin_listing_id, client_listing_id, message, stage
  ) VALUES (
    @name, @email, @phone, @whatsapp, 'canal-pro', @lead_type,
    @origin_lead_id, @origin_listing_id, @client_listing_id, @message, 'novo_lead'
  )
  ON CONFLICT(origin_lead_id) DO UPDATE SET
    name = excluded.name,
    email = COALESCE(excluded.email, leads.email),
    phone = COALESCE(excluded.phone, leads.phone),
    whatsapp = COALESCE(excluded.whatsapp, leads.whatsapp),
    lead_type = COALESCE(excluded.lead_type, leads.lead_type),
    message = COALESCE(excluded.message, leads.message),
    updated_at = datetime('now')
`);

const findByOrigin = db.prepare('SELECT id FROM leads WHERE origin_lead_id = ?');
const insertInteraction = db.prepare(
  'INSERT INTO interactions (lead_id, type, note) VALUES (?, ?, ?)'
);
const updateLog = db.prepare('UPDATE webhook_logs SET status = ?, error = ? WHERE id = ?');
const insertErrorLead = db.prepare(
  "INSERT INTO error_leads (payload, reason, source) VALUES (?, ?, 'canal-pro')"
);

function buildPhone(data) {
  const raw = data.phone ?? data.phoneNumber;
  if (raw == null) return null;
  const ddd = data.ddd != null ? String(data.ddd) : '';
  const num = String(raw);
  return num.startsWith(ddd) && ddd ? num : `${ddd}${num}`;
}

// better-sqlite3 é síncrono e a transação segura contra webhooks quase
// simultâneos do mesmo lead: o segundo vira UPDATE do primeiro, nunca duplicata.
const processTx = db.transaction((data) => {
  const phone = buildPhone(data);
  const existedBefore = findByOrigin.get(data.originLeadId);
  upsertLead.run({
    name: data.name.trim(),
    email: data.email ?? null,
    phone,
    whatsapp: data.extraData?.leadType === 'CLICK_WHATSAPP' ? phone : null,
    lead_type: data.extraData?.leadType ?? null,
    origin_lead_id: data.originLeadId,
    origin_listing_id: data.originListingId != null ? String(data.originListingId) : null,
    client_listing_id: data.clientListingId != null ? String(data.clientListingId) : null,
    message: data.message ?? null,
  });
  const lead = findByOrigin.get(data.originLeadId);
  const label = LEAD_TYPES[data.extraData?.leadType] ?? data.extraData?.leadType ?? 'contato';
  const origin = data.leadOrigin ?? 'Canal Pro';
  insertInteraction.run(
    lead.id,
    'lead_recebido',
    existedBefore
      ? `Novo evento via ${origin}: ${label}`
      : `Lead recebido via ${origin} (${label})${data.message ? ` — "${data.message}"` : ''}`
  );
  return { leadId: lead.id, updated: Boolean(existedBefore) };
});

export function processCanalProLead(rawBody, logId) {
  try {
    const parsed = fullSchema.safeParse(rawBody);
    if (!parsed.success) {
      const reason = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`)
        .join('; ');
      insertErrorLead.run(JSON.stringify(rawBody), reason);
      updateLog.run('error_lead', reason, logId);
      return;
    }
    const result = processTx(parsed.data);
    updateLog.run(result.updated ? 'processed_update' : 'processed_new', null, logId);
  } catch (err) {
    // Nunca deixa exceção derrubar o processo — o log guarda a falha para auditoria.
    console.error('[canal-pro] falha ao processar lead:', err);
    try {
      insertErrorLead.run(JSON.stringify(rawBody), `Erro interno: ${err.message}`);
      updateLog.run('failed', err.message, logId);
    } catch (inner) {
      console.error('[canal-pro] falha ao registrar erro:', inner);
    }
  }
}
