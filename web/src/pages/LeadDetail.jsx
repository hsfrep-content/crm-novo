import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { STAGES, stageById, NEIGHBORHOODS, SOURCE_LABELS, LEAD_TYPE_LABELS, fmtDate, fmtPrice, isOverdue, whatsappUrl } from '../lib';
import { Badge, Button, Card, Field, Input, Select, Modal, EmptyState } from '../components/ui';

const INTERACTION_ICONS = {
  lead_recebido: 'M8 1l2 4.2 4.6.5-3.4 3.1.9 4.5L8 11l-4.1 2.3.9-4.5L1.4 5.7 6 5.2 8 1z',
  mudanca_etapa: 'M2 8h9m0 0L8 5m3 3l-3 3M14 3v10',
  nota: 'M3 2h8l2 2v10H3V2zm3 5h4M6 10h4',
};

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState('timeline');
  const [note, setNote] = useState('');
  const [task, setTask] = useState({ title: '', due_at: '' });
  const [editOpen, setEditOpen] = useState(false);
  const [propModal, setPropModal] = useState(false);

  const reload = useCallback(() => {
    api.leads.get(id).then(setLead).catch((e) => e.status === 404 && setNotFound(true));
  }, [id]);
  useEffect(reload, [reload]);

  if (notFound) return <EmptyState title="Lead não encontrado" />;
  if (!lead) return null;

  const wa = whatsappUrl(lead.whatsapp || lead.phone);

  async function changeStage(e) {
    await api.leads.update(lead.id, { stage: e.target.value });
    reload();
  }

  async function addNote(e) {
    e.preventDefault();
    if (!note.trim()) return;
    await api.leads.addInteraction(lead.id, note.trim());
    setNote('');
    reload();
  }

  async function addTask(e) {
    e.preventDefault();
    if (!task.title.trim()) return;
    await api.leads.addTask(lead.id, {
      title: task.title.trim(),
      due_at: task.due_at ? task.due_at.replace('T', ' ') + ':00' : null,
    });
    setTask({ title: '', due_at: '' });
    reload();
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <Link to="/contatos" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
        ← Contatos
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{lead.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
            <Badge tone={lead.source === 'canal-pro' ? 'accent' : 'zinc'}>
              {SOURCE_LABELS[lead.source] ?? lead.source}
            </Badge>
            {lead.lead_type && <Badge>{LEAD_TYPE_LABELS[lead.lead_type] ?? lead.lead_type}</Badge>}
            {lead.tags.map((t) => <Badge key={t} tone="green">{t}</Badge>)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={lead.stage} onChange={changeStage}>
            {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
          <Button variant="secondary" onClick={() => setEditOpen(true)}>Editar</Button>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card className="p-3.5">
          <p className="text-xs font-medium text-zinc-400">Telefone</p>
          <p className="mt-0.5 text-sm font-medium">{lead.phone ?? '—'}</p>
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400">
              Abrir WhatsApp ↗
            </a>
          )}
        </Card>
        <Card className="p-3.5">
          <p className="text-xs font-medium text-zinc-400">E-mail</p>
          <p className="mt-0.5 truncate text-sm font-medium">{lead.email ?? '—'}</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-xs font-medium text-zinc-400">Interesse</p>
          <p className="mt-0.5 text-sm font-medium">
            {[lead.interest_type, lead.interest_neighborhood].filter(Boolean).join(' · ') || '—'}
          </p>
          {(lead.interest_price_min || lead.interest_price_max) && (
            <p className="text-xs text-zinc-400">
              {fmtPrice(lead.interest_price_min) ?? '…'} – {fmtPrice(lead.interest_price_max) ?? '…'}
            </p>
          )}
        </Card>
      </div>

      {lead.message && (
        <Card className="mb-5 border-l-2 border-l-accent-500 p-3.5 text-sm text-zinc-600 dark:text-zinc-300">
          “{lead.message}”
        </Card>
      )}

      <div className="mb-4 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {[
          ['timeline', `Histórico (${lead.interactions.length})`],
          ['tasks', `Tarefas (${lead.tasks.filter((t) => !t.done).length})`],
          ['properties', `Imóveis (${lead.properties.length})`],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? 'border-accent-600 text-accent-700 dark:text-accent-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'timeline' && (
        <div>
          <form onSubmit={addNote} className="mb-4 flex gap-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Registrar interação… (ligação, visita, negociação)" />
            <Button type="submit">Adicionar</Button>
          </form>
          {lead.interactions.length === 0 ? (
            <EmptyState title="Sem interações ainda" />
          ) : (
            <ol className="relative ml-2 space-y-4 border-l border-zinc-200 pl-5 dark:border-zinc-800">
              {lead.interactions.map((i) => (
                <li key={i.id} className="relative">
                  <span className="absolute -left-[27px] flex h-4 w-4 items-center justify-center rounded-full bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700">
                    <svg className="h-2.5 w-2.5 text-accent-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d={INTERACTION_ICONS[i.type] ?? INTERACTION_ICONS.nota} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <p className="text-sm">{i.note}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">{fmtDate(i.created_at)}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {tab === 'tasks' && (
        <div>
          <form onSubmit={addTask} className="mb-4 flex flex-wrap gap-2">
            <Input
              value={task.title}
              onChange={(e) => setTask((t) => ({ ...t, title: e.target.value }))}
              placeholder="Nova tarefa…"
              className="min-w-40 flex-1"
            />
            <Input
              type="datetime-local"
              value={task.due_at}
              onChange={(e) => setTask((t) => ({ ...t, due_at: e.target.value }))}
              className="w-auto"
            />
            <Button type="submit">Adicionar</Button>
          </form>
          {lead.tasks.length === 0 ? (
            <EmptyState title="Nenhuma tarefa" subtitle="Crie lembretes de follow-up para este contato." />
          ) : (
            <ul className="space-y-2">
              {lead.tasks.map((t) => {
                const overdue = isOverdue(t);
                return (
                  <li key={t.id}>
                    <Card className={`flex items-center gap-3 p-3 ${overdue ? 'ring-signal-200 dark:ring-signal-500/30' : ''}`}>
                      <input
                        type="checkbox"
                        checked={Boolean(t.done)}
                        onChange={(e) => api.leads.toggleTask(lead.id, t.id, e.target.checked).then(reload)}
                        className="h-4 w-4 rounded accent-[--color-accent-600]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${t.done ? 'text-zinc-400 line-through' : ''}`}>{t.title}</p>
                        {t.due_at && (
                          <p className={`text-xs ${overdue ? 'font-medium text-signal-600 dark:text-signal-400' : 'text-zinc-400'}`}>
                            {overdue && '⚠ Atrasada — '}{fmtDate(t.due_at)}
                          </p>
                        )}
                      </div>
                      <Button variant="danger" onClick={() => api.leads.removeTask(lead.id, t.id).then(reload)}>
                        Excluir
                      </Button>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {tab === 'properties' && (
        <div>
          <Button variant="secondary" className="mb-4" onClick={() => setPropModal(true)}>
            + Vincular imóvel
          </Button>
          {lead.properties.length === 0 ? (
            <EmptyState title="Nenhum imóvel vinculado" subtitle="Vincule imóveis do seu catálogo (ou sincronizados da Tecimob)." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {lead.properties.map((p) => (
                <Card key={p.id} className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{p.title}</p>
                    <Button variant="danger" onClick={() => api.leads.unlinkProperty(lead.id, p.id).then(reload)}>
                      Remover
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {[p.neighborhood, p.type, fmtPrice(p.price)].filter(Boolean).join(' · ')}
                  </p>
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-medium text-accent-600 hover:underline dark:text-accent-300">
                      Ver anúncio ↗
                    </a>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-8 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <Button
          variant="danger"
          onClick={async () => {
            if (confirm(`Excluir o lead "${lead.name}"? Essa ação não pode ser desfeita.`)) {
              await api.leads.remove(lead.id);
              navigate('/contatos');
            }
          }}
        >
          Excluir lead
        </Button>
      </div>

      <EditLeadModal lead={lead} open={editOpen} onClose={() => setEditOpen(false)} onSaved={reload} />
      <LinkPropertyModal lead={lead} open={propModal} onClose={() => setPropModal(false)} onLinked={reload} />
    </div>
  );
}

function EditLeadModal({ lead, open, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (open) {
      setForm({
        name: lead.name,
        phone: lead.phone ?? '',
        whatsapp: lead.whatsapp ?? '',
        email: lead.email ?? '',
        interest_type: lead.interest_type ?? '',
        interest_neighborhood: lead.interest_neighborhood ?? '',
        interest_price_min: lead.interest_price_min ?? '',
        interest_price_max: lead.interest_price_max ?? '',
        tags: lead.tags,
      });
    }
  }, [open, lead]);

  if (!form) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    await api.leads.update(lead.id, {
      ...form,
      phone: form.phone || null,
      whatsapp: form.whatsapp || null,
      email: form.email || null,
      interest_type: form.interest_type || null,
      interest_neighborhood: form.interest_neighborhood || null,
      interest_price_min: form.interest_price_min ? Number(form.interest_price_min) : null,
      interest_price_max: form.interest_price_max ? Number(form.interest_price_max) : null,
    });
    onSaved();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Editar contato" wide>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome *"><Input value={form.name} onChange={set('name')} required /></Field>
        <Field label="E-mail"><Input value={form.email} onChange={set('email')} /></Field>
        <Field label="Telefone"><Input value={form.phone} onChange={set('phone')} /></Field>
        <Field label="WhatsApp"><Input value={form.whatsapp} onChange={set('whatsapp')} /></Field>
        <Field label="Tipo de imóvel">
          <Select value={form.interest_type} onChange={set('interest_type')} className="w-full">
            <option value="">—</option>
            <option>Apartamento</option><option>Casa</option><option>Cobertura</option>
            <option>Flat</option><option>Terreno</option>
          </Select>
        </Field>
        <Field label="Bairro principal">
          <Select value={form.interest_neighborhood} onChange={set('interest_neighborhood')} className="w-full">
            <option value="">—</option>
            {NEIGHBORHOODS.map((n) => <option key={n}>{n}</option>)}
          </Select>
        </Field>
        <Field label="Preço mín. (R$)"><Input type="number" value={form.interest_price_min} onChange={set('interest_price_min')} /></Field>
        <Field label="Preço máx. (R$)"><Input type="number" value={form.interest_price_max} onChange={set('interest_price_max')} /></Field>
        <div className="sm:col-span-2">
          <Field label="Tags de bairro">
            <div className="flex flex-wrap gap-1.5">
              {NEIGHBORHOODS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      tags: f.tags.includes(n) ? f.tags.filter((t) => t !== n) : [...f.tags, n],
                    }))
                  }
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-colors ${
                    form.tags.includes(n)
                      ? 'bg-accent-600 text-white ring-accent-600'
                      : 'bg-white text-zinc-600 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Salvar</Button>
        </div>
      </form>
    </Modal>
  );
}

function LinkPropertyModal({ lead, open, onClose, onLinked }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => api.properties.list(q).then(setResults).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q, open]);

  const linkedIds = new Set(lead.properties.map((p) => p.id));

  return (
    <Modal open={open} onClose={onClose} title="Vincular imóvel" wide>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título ou bairro…" autoFocus />
      <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto">
        {results.length === 0 && (
          <p className="py-6 text-center text-sm text-zinc-400">
            Nenhum imóvel no catálogo. Sincronize com a Tecimob em Integrações.
          </p>
        )}
        {results.map((p) => (
          <button
            key={p.id}
            disabled={linkedIds.has(p.id)}
            onClick={() => api.leads.linkProperty(lead.id, p.id).then(() => { onLinked(); onClose(); })}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-50 disabled:opacity-40 dark:hover:bg-zinc-800"
          >
            <span>
              <span className="font-medium">{p.title}</span>
              <span className="ml-2 text-xs text-zinc-400">
                {[p.neighborhood, p.type, fmtPrice(p.price)].filter(Boolean).join(' · ')}
              </span>
            </span>
            {linkedIds.has(p.id) && <Badge tone="green">vinculado</Badge>}
          </button>
        ))}
      </div>
    </Modal>
  );
}
