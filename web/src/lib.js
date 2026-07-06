// Cores das etapas: paleta categórica validada (CVD + contraste) para os
// pontos do Kanban e as barras do funil no dashboard, em claro e escuro.
export const STAGES = [
  { id: 'importado', label: 'Leads Importação .csv', color: '#A65D2E', dot: 'bg-[#A65D2E]' },
  { id: 'novo_lead', label: 'Novo Lead', color: '#3E86C6', dot: 'bg-[#3E86C6]' },
  { id: 'contato_feito', label: 'Contato Feito', color: '#4A5FC1', dot: 'bg-[#4A5FC1]' },
  { id: 'visita_agendada', label: 'Visita Agendada', color: '#00A3A3', dot: 'bg-[#00A3A3]' },
  { id: 'proposta', label: 'Proposta', color: '#A87F1E', dot: 'bg-[#A87F1E]' },
  { id: 'contrato', label: 'Contrato', color: '#B04A8F', dot: 'bg-[#B04A8F]' },
  { id: 'fechado', label: 'Fechado', color: '#2E9E68', dot: 'bg-[#2E9E68]' },
  { id: 'perdido', label: 'Perdido', color: '#D23440', dot: 'bg-[#D23440]' },
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
  'chaves-na-mao': 'Chaves na Mão',
  tecimob: 'Tecimob',
  indicacao: 'Indicação',
  importacao: 'Importação',
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
