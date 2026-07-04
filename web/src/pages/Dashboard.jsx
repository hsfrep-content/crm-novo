import { useEffect, useState } from 'react';
import { api } from '../api';
import { STAGES, SOURCE_LABELS, LEAD_TYPE_LABELS } from '../lib';
import { Card } from '../components/ui';

function Stat({ label, value, sub, tone = '' }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-zinc-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${tone}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
    </Card>
  );
}

function BarList({ title, items, colorClass = 'bg-accent-500' }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="py-4 text-center text-xs text-zinc-400">Sem dados ainda</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="font-medium text-zinc-600 dark:text-zinc-300">{item.label}</span>
                <span className="tabular-nums text-zinc-400">{item.n}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-full ${item.color ?? colorClass} transition-all duration-500`}
                  style={{ width: `${(item.n / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.dashboard().then(setData).catch(() => {});
  }, []);

  if (!data) return null;

  const funnel = STAGES.map((s) => ({ label: s.label, n: data.byStage[s.id] ?? 0, color: s.dot }));
  const sources = data.bySource.map((s) => ({ label: SOURCE_LABELS[s.source] ?? s.source, n: s.n }));
  const leadTypes = data.byLeadType.map((t) => ({ label: LEAD_TYPE_LABELS[t.lead_type] ?? t.lead_type, n: t.n }));

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <h1 className="mb-4 text-lg font-semibold tracking-tight">Dashboard</h1>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total de leads" value={data.total} />
        <Stat
          label="Taxa de conversão"
          value={data.conversion != null ? `${data.conversion}%` : '—'}
          sub={`${data.won} fechados · ${data.lost} perdidos`}
          tone="text-emerald-600 dark:text-emerald-400"
        />
        <Stat label="Novos (últimos 7 dias)" value={data.last7days.reduce((acc, d) => acc + d.n, 0)} />
        <Stat
          label="Tarefas atrasadas"
          value={data.overdueTasks}
          tone={data.overdueTasks > 0 ? 'text-signal-600 dark:text-signal-400' : ''}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarList title="Leads por etapa" items={funnel} />
        <div className="space-y-4">
          <BarList title="Leads por origem" items={sources} />
          <BarList title="Canal Pro por tipo de contato" items={leadTypes} colorClass="bg-[#A87F1E]" />
        </div>
      </div>
    </div>
  );
}
