export const STAGES = [
  { id: 'novo_lead', label: 'Novo Lead', dot: 'bg-sky-500' },
  { id: 'contato_feito', label: 'Contato Feito', dot: 'bg-indigo-500' },
  { id: 'visita_agendada', label: 'Visita Agendada', dot: 'bg-violet-500' },
  { id: 'proposta', label: 'Proposta', dot: 'bg-amber-500' },
  { id: 'contrato', label: 'Contrato', dot: 'bg-orange-500' },
  { id: 'fechado', label: 'Fechado', dot: 'bg-emerald-500' },
  { id: 'perdido', label: 'Perdido', dot: 'bg-rose-500' },
];

export const stageById = Object.fromEntries(STAGES.map((s) => [s.id, s]));

export const NEIGHBORHOODS = ['Pina', 'Boa Viagem', 'Piedade', 'Candeias', 'Paiva'];

export const LEAD_TYPE_LABELS = {
  CLICK_SCHEDULE: 'Agendamento',
  CLICK_WHATSAPP: 'WhatsApp',
  CONTACT_CHAT: 'Chat',
  CONTACT_FORM: 'Formulário',
  PHONE_VIEW: 'Viu telefone',
  VISIT_REQUEST: 'Pedido de visita',
};

export const SOURCE_LABELS = {
  manual: 'Manual',
  'canal-pro': 'Canal Pro',
  tecimob: 'Tecimob',
  indicacao: 'Indicação',
};

export function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function fmtPrice(cents) {
  if (cents == null) return null;
  return cents.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export function isOverdue(task) {
  return !task.done && task.due_at && new Date(task.due_at.replace(' ', 'T') + 'Z') < new Date();
}

export function whatsappUrl(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  return digits ? `https://wa.me/55${digits}` : null;
}
