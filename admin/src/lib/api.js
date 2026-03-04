const API_BASE = '/api/admin';

function getToken() {
  return localStorage.getItem('nox_admin_token') || '';
}

export function setToken(token) {
  localStorage.setItem('nox_admin_token', token);
}

export function clearToken() {
  localStorage.removeItem('nox_admin_token');
}

export function hasToken() {
  return !!localStorage.getItem('nox_admin_token');
}

async function request(path, options = {}) {
  const { method = 'GET', body, noAuth = false } = options;

  const headers = { 'Content-Type': 'application/json' };
  if (!noAuth) {
    headers['Authorization'] = `Bearer ${getToken()}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 || res.status === 403) {
    clearToken();
    window.location.reload();
    throw new Error('Unauthorized');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Auth
export const login = (token) => request('/login', { method: 'POST', body: { token }, noAuth: true });

// Config
export const getConfig = () => request('/config');
export const updateConfig = (key, value) => request('/config', { method: 'PUT', body: { key, value } });

// Guardrails
export const getGuardrails = () => request('/guardrails');

// Tone Rules
export const getToneRules = () => request('/tone-rules');
export const createToneRule = (data) => request('/tone-rules', { method: 'POST', body: data });
export const updateToneRule = (id, data) => request(`/tone-rules/${id}`, { method: 'PUT', body: data });
export const deleteToneRule = (id) => request(`/tone-rules/${id}`, { method: 'DELETE' });

// Scenarios
export const getScenarios = () => request('/scenarios');
export const getScenario = (id) => request(`/scenarios/${id}`);
export const createScenario = (data) => request('/scenarios', { method: 'POST', body: data });
export const updateScenario = (id, data) => request(`/scenarios/${id}`, { method: 'PUT', body: data });

// Scenario Fields
export const createScenarioField = (scenarioId, data) => request(`/scenarios/${scenarioId}/fields`, { method: 'POST', body: data });
export const updateScenarioField = (fieldId, data) => request(`/scenarios/fields/${fieldId}`, { method: 'PUT', body: data });
export const deleteScenarioField = (fieldId) => request(`/scenarios/fields/${fieldId}`, { method: 'DELETE' });

// Sessions
export const getSessions = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/sessions${qs ? `?${qs}` : ''}`);
};
export const getSession = (id) => request(`/sessions/${id}`);
export const deleteSession = (id) => request(`/sessions/${id}`, { method: 'DELETE' });

// Handoffs
export const getHandoffs = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/handoffs${qs ? `?${qs}` : ''}`);
};

// Stats
export const getStats = () => request('/stats');

// Prompt Preview
export const getPromptPreview = () => request('/prompt-preview');

// Config Reset
export const resetConfig = () => request('/config/reset', { method: 'POST' });

// SOP Tools (Swarm Architecture)
export const getScenarioTools = (scenarioId) => request(`/scenarios/${scenarioId}/tools`);
export const createScenarioTool = (scenarioId, data) => request(`/scenarios/${scenarioId}/tools`, { method: 'POST', body: data });
export const updateTool = (toolId, data) => request(`/tools/${toolId}`, { method: 'PUT', body: data });
export const deleteTool = (toolId) => request(`/tools/${toolId}`, { method: 'DELETE' });
export const testTool = (toolId, input) => request(`/tools/${toolId}/test`, { method: 'POST', body: { input } });

// Chat Test (uses main chat endpoint, not admin)
export const testChat = async (sessionId, message) => {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Chat request failed (${res.status})`);
  return data;
};
