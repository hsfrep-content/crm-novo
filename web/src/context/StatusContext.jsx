import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api';

// Estado global das integrações: alimenta os banners do topo
// (chave Tecimob inválida / sincronização indisponível) e a tela de status.
const StatusContext = createContext(null);

export function StatusProvider({ children }) {
  const [status, setStatus] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await api.integrations.status());
    } catch {
      // backend fora do ar: mantém o último status conhecido
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  return <StatusContext.Provider value={{ status, refresh }}>{children}</StatusContext.Provider>;
}

export function useIntegrationStatus() {
  return useContext(StatusContext);
}
