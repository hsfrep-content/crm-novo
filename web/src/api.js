// Cliente HTTP único do frontend — todos os componentes falam com o backend
// por aqui; nenhum componente usa fetch() direto.

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new ApiError('Sem conexão com o servidor.', 0, 'network');
  }
  if (res.status === 204) return null;
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* respostas sem corpo */
  }
  if (!res.ok) {
    throw new ApiError(body?.error || `Erro ${res.status}`, res.status, body?.code);
  }
  return body;
}

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const api = {
  leads: {
    list: (filters = {}) => {
      const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
      return request(`/api/leads${qs.size ? `?${qs}` : ''}`);
    },
    get: (id) => request(`/api/leads/${id}`),
    create: (data) => request('/api/leads', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id) => request(`/api/leads/${id}`, { method: 'DELETE' }),
    addTask: (id, data) => request(`/api/leads/${id}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
    toggleTask: (id, taskId, done) =>
      request(`/api/leads/${id}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ done }) }),
    removeTask: (id, taskId) => request(`/api/leads/${id}/tasks/${taskId}`, { method: 'DELETE' }),
    addInteraction: (id, note) =>
      request(`/api/leads/${id}/interactions`, { method: 'POST', body: JSON.stringify({ note }) }),
    linkProperty: (id, propertyId) => request(`/api/leads/${id}/properties/${propertyId}`, { method: 'POST' }),
    unlinkProperty: (id, propertyId) => request(`/api/leads/${id}/properties/${propertyId}`, { method: 'DELETE' }),
    exportUrl: '/api/leads/export.csv',
    import: (leads, options = {}) =>
      request('/api/leads/import', { method: 'POST', body: JSON.stringify({ leads, ...options }) }),
  },
  properties: {
    list: (q) => request(`/api/properties${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    create: (data) => request('/api/properties', { method: 'POST', body: JSON.stringify(data) }),
  },
  dashboard: () => request('/api/dashboard'),
  settings: {
    get: () => request('/api/settings'),
    saveTecimobKey: (apiKey) =>
      request('/api/settings/tecimob-key', { method: 'POST', body: JSON.stringify({ apiKey }) }),
    removeTecimobKey: () => request('/api/settings/tecimob-key', { method: 'DELETE' }),
  },
  integrations: {
    status: () => request('/api/settings/integrations/status'),
    sync: () => request('/api/settings/integrations/tecimob/sync', { method: 'POST' }),
    errorLeads: () => request('/api/settings/integrations/error-leads'),
    reviewErrorLead: (id) =>
      request(`/api/settings/integrations/error-leads/${id}/review`, { method: 'POST' }),
  },
};
