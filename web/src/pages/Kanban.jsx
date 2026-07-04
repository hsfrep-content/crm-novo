import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { STAGES, NEIGHBORHOODS, SOURCE_LABELS, LEAD_TYPE_LABELS } from '../lib';
import { Badge, Button } from '../components/ui';
import NewLeadModal from '../components/NewLeadModal';

function LeadCard({ lead, onDragStart, onClick }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="group cursor-pointer rounded-lg bg-white p-3 shadow-sm ring-1 ring-zinc-950/5 transition-all duration-150 hover:shadow-md hover:ring-accent-300 dark:bg-zinc-900 dark:ring-white/10 dark:hover:ring-accent-500/50"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight">{lead.name}</p>
        {lead.overdue_tasks > 0 && (
          <span
            className="flex h-2 w-2 shrink-0 rounded-full bg-rose-500 ring-2 ring-rose-100 dark:ring-rose-500/20"
            title={`${lead.overdue_tasks} tarefa(s) atrasada(s)`}
          />
        )}
      </div>
      {lead.phone && <p className="mt-0.5 text-xs text-zinc-500">{lead.phone}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Badge tone={lead.source === 'canal-pro' ? 'accent' : 'zinc'}>
          {SOURCE_LABELS[lead.source] ?? lead.source}
        </Badge>
        {lead.lead_type && <Badge tone="zinc">{LEAD_TYPE_LABELS[lead.lead_type] ?? lead.lead_type}</Badge>}
        {lead.tags.slice(0, 2).map((t) => (
          <Badge key={t} tone="green">{t}</Badge>
        ))}
      </div>
    </div>
  );
}

export default function Kanban() {
  const [leads, setLeads] = useState([]);
  const [tagFilter, setTagFilter] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [modalStage, setModalStage] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.leads.list().then(setLeads).catch(() => {});
  }, []);

  const filtered = useMemo(
    () => (tagFilter ? leads.filter((l) => l.tags.includes(tagFilter)) : leads),
    [leads, tagFilter]
  );
  const byStage = useMemo(() => {
    const map = Object.fromEntries(STAGES.map((s) => [s.id, []]));
    for (const lead of filtered) (map[lead.stage] ?? map.novo_lead).push(lead);
    return map;
  }, [filtered]);

  async function moveTo(stageId, e) {
    e.preventDefault();
    setDragOver(null);
    const id = Number(e.dataTransfer.getData('text/lead-id'));
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.stage === stageId) return;
    const previous = leads;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, stage: stageId } : l))); // otimista
    try {
      await api.leads.update(id, { stage: stageId });
    } catch {
      setLeads(previous); // desfaz se o servidor recusar
    }
  }

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col p-4 md:h-screen md:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-lg font-semibold tracking-tight">Funil de vendas</h1>
        <div className="flex flex-wrap gap-1.5">
          {NEIGHBORHOODS.map((n) => (
            <button
              key={n}
              onClick={() => setTagFilter(tagFilter === n ? null : n)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-colors ${
                tagFilter === n
                  ? 'bg-accent-600 text-white ring-accent-600'
                  : 'bg-white text-zinc-600 ring-zinc-200 hover:ring-accent-400 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 gap-3 overflow-x-auto pb-2">
        {STAGES.map((stage) => (
          <div
            key={stage.id}
            onDragOver={(e) => { e.preventDefault(); setDragOver(stage.id); }}
            onDragLeave={() => setDragOver((d) => (d === stage.id ? null : d))}
            onDrop={(e) => moveTo(stage.id, e)}
            className={`flex w-64 shrink-0 flex-col rounded-xl bg-zinc-100/70 p-2 transition-colors dark:bg-zinc-900/60 ${
              dragOver === stage.id ? 'col-drag-over' : ''
            }`}
          >
            <div className="mb-2 flex items-center gap-2 px-1.5 pt-1">
              <span className={`h-2 w-2 rounded-full ${stage.dot}`} />
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {stage.label}
              </span>
              <span className="ml-auto rounded-md bg-white px-1.5 text-xs font-medium text-zinc-400 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
                {byStage[stage.id].length}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-0.5">
              {byStage[stage.id].map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onClick={() => navigate(`/contatos/${lead.id}`)}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/lead-id', String(lead.id));
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                />
              ))}
              <button
                onClick={() => setModalStage(stage.id)}
                className="rounded-lg border border-dashed border-zinc-300 py-1.5 text-xs font-medium text-zinc-400 opacity-0 transition-opacity hover:border-accent-400 hover:text-accent-600 focus:opacity-100 group-hover:opacity-100 dark:border-zinc-700 [div:hover>div>&]:opacity-100"
              >
                + Adicionar
              </button>
            </div>
          </div>
        ))}
      </div>

      <NewLeadModal
        open={modalStage !== null}
        defaultStage={modalStage ?? 'novo_lead'}
        onClose={() => setModalStage(null)}
        onCreated={(lead) => setLeads((ls) => [{ ...lead, overdue_tasks: 0 }, ...ls])}
      />
    </div>
  );
}
