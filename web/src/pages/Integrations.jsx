import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useIntegrationStatus } from '../context/StatusContext';
import { fmtDate } from '../lib';
import { Badge, Button, Card, Spinner, EmptyState } from '../components/ui';

export default function Integrations() {
  const { status, refresh } = useIntegrationStatus() ?? {};
  const [errorLeads, setErrorLeads] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  const loadErrors = () => api.integrations.errorLeads().then(setErrorLeads).catch(() => {});
  useEffect(() => { loadErrors(); }, []);

  async function runSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const result = await api.integrations.sync();
      setSyncMsg({ ok: true, text: `Sincronização concluída: ${result.imported} imóveis atualizados${result.skipped ? `, ${result.skipped} registros inválidos ignorados` : ''}.` });
    } catch (err) {
      const messages = {
        auth: 'Chave de API inválida — reconecte em Configurações.',
        no_key: 'Nenhuma chave configurada — adicione em Configurações.',
        timeout: 'Tecimob não respondeu (10s). Tente novamente em instantes.',
        rate_limit: 'Limite de requisições atingido mesmo após 3 tentativas. Aguarde alguns minutos.',
        server: 'Tecimob instável no momento — o CRM segue com os dados locais.',
        network: 'Falha de rede ao contatar a Tecimob.',
      };
      setSyncMsg({ ok: false, text: messages[err.code] ?? err.message });
    } finally {
      setSyncing(false);
      refresh?.();
    }
  }

  const tecimob = status?.tecimob;
  const canalPro = status?.canalPro;

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <h1 className="mb-4 text-lg font-semibold tracking-tight">Status das integrações</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Tecimob</h2>
            {tecimob?.connected ? (
              tecimob.lastError ? <Badge tone="rose">erro</Badge> : <Badge tone="green">conectada</Badge>
            ) : (
              <Badge>não configurada</Badge>
            )}
          </div>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-400">Última sincronização</dt>
              <dd className="font-medium">{tecimob?.lastSyncAt ? fmtDate(tecimob.lastSyncAt) : 'nunca'}</dd>
            </div>
            {tecimob?.lastImported != null && (
              <div className="flex justify-between">
                <dt className="text-zinc-400">Imóveis na última sync</dt>
                <dd className="font-medium">{tecimob.lastImported}</dd>
              </div>
            )}
          </dl>
          {tecimob?.lastError && (
            <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
              {tecimob.lastError.code === 'auth'
                ? <>Chave de API inválida — <Link to="/configuracoes" className="underline">reconecte em Configurações</Link>.</>
                : `Última tentativa falhou: ${tecimob.lastError.message}`}
            </p>
          )}
          <Button className="mt-4" onClick={runSync} disabled={syncing || !tecimob?.connected}>
            {syncing && <Spinner />}
            {syncing ? 'Sincronizando…' : 'Sincronizar agora'}
          </Button>
          {syncMsg && (
            <p className={`mt-2 text-xs ${syncMsg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-300'}`}>
              {syncMsg.text}
            </p>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Canal Pro (OLX/ZAP/Viva Real)</h2>
            <Badge tone="accent">webhook</Badge>
          </div>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-400">Leads nas últimas 24h</dt>
              <dd className="text-xl font-semibold tabular-nums">{canalPro?.leadsLast24h ?? 0}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">Último webhook</dt>
              <dd className="font-medium">{canalPro?.lastWebhookAt ? fmtDate(canalPro.lastWebhookAt) : 'nenhum ainda'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">Erros pendentes</dt>
              <dd>
                {canalPro?.pendingErrors ? (
                  <Badge tone="amber">{canalPro.pendingErrors} para revisar</Badge>
                ) : (
                  <Badge tone="green">nenhum</Badge>
                )}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <h2 className="mb-2 mt-8 text-sm font-semibold">Leads com erro (revisão manual)</h2>
      <p className="mb-3 text-xs text-zinc-400">
        Webhooks do Canal Pro que chegaram com campos obrigatórios ausentes. Nada é descartado:
        revise e cadastre manualmente se necessário.
      </p>
      {errorLeads.length === 0 ? (
        <Card><EmptyState title="Nenhum lead com erro" subtitle="Tudo processado normalmente." /></Card>
      ) : (
        <div className="space-y-2">
          {errorLeads.map((e) => (
            <Card key={e.id} className="p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-rose-600 dark:text-rose-300">{e.reason}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">{fmtDate(e.received_at)}</p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => api.integrations.reviewErrorLead(e.id).then(() => { loadErrors(); refresh?.(); })}
                >
                  Marcar como revisado
                </Button>
              </div>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-50 p-2.5 text-xs text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
                {JSON.stringify(e.payload, null, 2)}
              </pre>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
