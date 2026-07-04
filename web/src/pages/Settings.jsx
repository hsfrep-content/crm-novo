import { useEffect, useState } from 'react';
import { api } from '../api';
import { Button, Card, Field, Input, Badge } from '../components/ui';

export default function Settings() {
  const [configured, setConfigured] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.settings.get().then((s) => setConfigured(s.tecimobKeyConfigured)).catch(() => {});
  }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await api.settings.saveTecimobKey(apiKey);
      setConfigured(true);
      setApiKey('');
      setFeedback({ ok: true, text: 'Chave salva com segurança. Rode uma sincronização em Integrações para testar.' });
    } catch (err) {
      setFeedback({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    if (!confirm('Remover a chave da API Tecimob?')) return;
    await api.settings.removeTecimobKey();
    setConfigured(false);
    setFeedback(null);
  }

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <h1 className="mb-4 text-lg font-semibold tracking-tight">Configurações</h1>

      <Card className="p-5">
        <div className="mb-1 flex items-center gap-2">
          <h2 className="text-sm font-semibold">Integração Tecimob</h2>
          {configured ? <Badge tone="green">conectada</Badge> : <Badge>não configurada</Badge>}
        </div>
        <p className="mb-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          A chave é armazenada <strong>criptografada</strong> (AES-256-GCM) no banco do servidor e
          nunca é exibida nem enviada ao navegador. Para trocar, basta salvar uma nova.
        </p>

        <form onSubmit={save} className="space-y-3">
          <Field label={configured ? 'Substituir chave de API' : 'Chave de API'}>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Cole aqui a chave gerada no painel Tecimob"
              autoComplete="off"
            />
          </Field>
          {feedback && (
            <p className={`text-sm ${feedback.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
              {feedback.text}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={saving || apiKey.length < 8}>
              {saving ? 'Salvando…' : 'Salvar chave'}
            </Button>
            {configured && (
              <Button type="button" variant="danger" onClick={disconnect}>
                Desconectar
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="mb-1 text-sm font-semibold">Webhook do Canal Pro</h2>
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Cadastre a URL abaixo no painel do Canal Pro em{' '}
          <em>Configurações da conta → Recebimento de leads → Integração de leads</em>:
        </p>
        <code className="mt-2 block rounded-lg bg-zinc-100 px-3 py-2 text-xs dark:bg-zinc-800">
          {window.location.origin}/webhooks/canal-pro
        </code>
        <p className="mt-2 text-xs text-zinc-400">
          Use a URL pública do seu deploy (Railway, Render etc.) — veja o passo a passo no README.
        </p>
      </Card>
    </div>
  );
}
