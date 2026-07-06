import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { BrandLockup } from '../components/Layout';
import { Button, Field, Input } from '../components/ui';

// Tela de login — conta Google autorizada e/ou e-mail + senha da equipe,
// conforme o que estiver habilitado no servidor. Ambos restritos à allowlist.
export default function Login() {
  const { clientId, passwordLogin, setUser } = useAuth();
  const buttonRef = useRef(null);
  const [error, setError] = useState(null);
  const [scriptFailed, setScriptFailed] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    function renderButton() {
      if (cancelled || !window.google?.accounts?.id || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          setError(null);
          try {
            const { user } = await api.auth.google(response.credential);
            setUser(user);
          } catch (err) {
            setError(err.message);
          }
        },
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        locale: 'pt-BR',
        width: 280,
      });
    }

    if (window.google?.accounts?.id) {
      renderButton();
      return () => { cancelled = true; };
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = renderButton;
    script.onerror = () => !cancelled && setScriptFailed(true);
    document.head.appendChild(script);
    return () => { cancelled = true; };
  }, [clientId, setUser]);

  async function submitPassword(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { user } = await api.auth.password(form.email, form.password);
      setUser(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-900 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <BrandLockup />
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-950/60 dark:ring-1 dark:ring-white/10">
          <h1 className="text-center text-lg font-semibold">Acessar o CRM</h1>
          <p className="mt-1 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Acesso restrito à equipe autorizada.
          </p>

          {passwordLogin && (
            <form onSubmit={submitPassword} className="mt-6 space-y-3">
              <Field label="E-mail">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="voce@exemplo.com"
                  autoComplete="username"
                  required
                  autoFocus
                />
              </Field>
              <Field label="Senha">
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </Field>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Entrando…' : 'Entrar'}
              </Button>
            </form>
          )}

          {passwordLogin && clientId && (
            <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-zinc-400">
              <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
              ou
              <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
            </div>
          )}

          {clientId && <div className={`flex min-h-11 justify-center ${passwordLogin ? '' : 'mt-6'}`} ref={buttonRef} />}
          {clientId && scriptFailed && (
            <p className="mt-3 text-center text-xs text-signal-600 dark:text-signal-300">
              Não foi possível carregar o login do Google. Verifique sua conexão e recarregue a página.
            </p>
          )}

          {error && (
            <p className="mt-4 rounded-lg bg-signal-50 px-3 py-2 text-center text-sm text-signal-700 dark:bg-signal-500/10 dark:text-signal-300">
              {error}
            </p>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-cream/40">
          Acesso restrito à equipe A&amp;L Negócios Imobiliários.
        </p>
      </div>
    </div>
  );
}
