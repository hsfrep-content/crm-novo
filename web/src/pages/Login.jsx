import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { BrandLockup } from '../components/Layout';

// Tela de login — exclusivamente com conta Google (Google Identity Services).
export default function Login() {
  const { clientId, setUser } = useAuth();
  const buttonRef = useRef(null);
  const [error, setError] = useState(null);
  const [scriptFailed, setScriptFailed] = useState(false);

  useEffect(() => {
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-900 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <BrandLockup />
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-950/60 dark:ring-1 dark:ring-white/10">
          <h1 className="text-center text-lg font-semibold">Acessar o CRM</h1>
          <p className="mt-1 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Entre com sua conta Google autorizada.
          </p>
          <div className="mt-6 flex min-h-11 justify-center" ref={buttonRef} />
          {scriptFailed && (
            <p className="mt-3 text-center text-xs text-signal-600 dark:text-signal-300">
              Não foi possível carregar o login do Google. Verifique sua conexão e recarregue a página.
            </p>
          )}
          {error && (
            <p className="mt-3 text-center text-sm text-signal-600 dark:text-signal-300">{error}</p>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-cream/40">
          Acesso restrito à equipe A&amp;L Negócios Imobiliários.
        </p>
      </div>
    </div>
  );
}
