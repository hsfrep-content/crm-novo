import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { NEIGHBORHOODS, STAGES, stageById, SOURCE_LABELS, fmtDate } from '../lib';
import { Badge, Button, Card, Input, Select, EmptyState } from '../components/ui';
import NewLeadModal from '../components/NewLeadModal';
import ImportLeadsModal from '../components/ImportLeadsModal';

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', tag: '', stage: '', source: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api.leads
        .list(filters)
        .then(setLeads)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250); // debounce da busca
    return () => clearTimeout(t);
  }, [filters, reloadKey]);

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-lg font-semibold tracking-tight">Contatos</h1>
        <Button variant="secondary" onClick={() => setImportOpen(true)}>
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 10V2m0 0L5 5m3-3l3 3M3 13h10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Importar CSV
        </Button>
        <a href={api.leads.exportUrl} download>
          <Button variant="secondary">
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Exportar CSV
          </Button>
        </a>
        <Button onClick={() => setModalOpen(true)}>+ Novo lead</Button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <Input
          value={filters.q}
          onChange={set('q')}
          placeholder="Buscar por nome, e-mail ou telefone…"
          className="max-w-xs"
        />
        <Select value={filters.stage} onChange={set('stage')}>
          <option value="">Todas as etapas</option>
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </Select>
        <Select value={filters.source} onChange={set('source')}>
          <option value="">Todas as origens</option>
          {Object.entries(SOURCE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {NEIGHBORHOODS.map((n) => (
          <button
            key={n}
            onClick={() => setFilters((f) => ({ ...f, tag: f.tag === n ? '' : n }))}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-colors ${
              filters.tag === n
                ? 'bg-accent-600 text-white ring-accent-600'
                : 'bg-white text-zinc-600 ring-zinc-200 hover:ring-accent-400 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <Card className="overflow-x-auto">
        {leads.length === 0 && !loading ? (
          <EmptyState title="Nenhum contato encontrado" subtitle="Ajuste os filtros ou crie um novo lead." />
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                <th className="px-4 py-2.5 font-medium">Nome</th>
                <th className="px-4 py-2.5 font-medium">Telefone</th>
                <th className="px-4 py-2.5 font-medium">Etapa</th>
                <th className="px-4 py-2.5 font-medium">Origem</th>
                <th className="px-4 py-2.5 font-medium">Bairros</th>
                <th className="px-4 py-2.5 font-medium">Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b border-zinc-50 transition-colors last:border-0 hover:bg-zinc-50/70 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40"
                >
                  <td className="px-4 py-2.5">
                    <Link to={`/contatos/${lead.id}`} className="font-medium text-accent-700 hover:underline dark:text-accent-300">
                      {lead.name}
                    </Link>
                    {lead.overdue_tasks > 0 && (
                      <Badge tone="rose" className="ml-2">{lead.overdue_tasks} atrasada(s)</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-500">{lead.phone ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${stageById[lead.stage]?.dot ?? 'bg-zinc-400'}`} />
                      {stageById[lead.stage]?.label ?? lead.stage}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={lead.source === 'canal-pro' ? 'accent' : 'zinc'}>
                      {SOURCE_LABELS[lead.source] ?? lead.source}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {lead.tags.map((t) => <Badge key={t} tone="green">{t}</Badge>)}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-zinc-400">{fmtDate(lead.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <NewLeadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(lead) => setLeads((ls) => [{ ...lead, overdue_tasks: 0 }, ...ls])}
      />
      <ImportLeadsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => setReloadKey((k) => k + 1)}
      />
    </div>
  );
}
