import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api';

// Estado de autenticação. Três modos:
//  - carregando (primeira verificação)
//  - login ativo: exige conta Google autorizada (user preenchido após login)
//  - modo aberto: servidor sem GOOGLE_CLIENT_ID → sem login, com aviso na UI
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, enabled: false, clientId: null, user: null });

  const load = useCallback(async () => {
    try {
      const config = await api.auth.config();
      if (!config.enabled) {
        setState({ loading: false, enabled: false, clientId: null, user: null });
        return;
      }
      let user = null;
      try {
        user = (await api.auth.me()).user;
      } catch {
        /* sem sessão */
      }
      setState({ loading: false, enabled: true, clientId: config.clientId, user });
    } catch {
      // backend fora do ar: tenta de novo em alguns segundos
      setTimeout(load, 4000);
    }
  }, []);

  useEffect(() => {
    load();
    const onExpired = () => setState((s) => (s.enabled ? { ...s, user: null } : s));
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [load]);

  const setUser = (user) => setState((s) => ({ ...s, user }));
  const logout = async () => {
    await api.auth.logout().catch(() => {});
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ ...state, setUser, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
