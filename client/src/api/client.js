const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '') + '/api';

async function request(endpoint, options = {}) {
  const config = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Server request failed');
  }

  return data;
}

export const api = {
  getHealth: () => request('/health', { method: 'GET' }),
  importSchema: (sqlContent) => request('/schema/import', { method: 'POST', body: JSON.stringify({ sqlContent }) }),
  getSchema: () => request('/schema', { method: 'GET' }),
  connectDb: (config) => request('/db/connect', { method: 'POST', body: JSON.stringify(config) }),
  disconnectDb: () => request('/db/disconnect', { method: 'POST' }),
  getDbStatus: () => request('/db/status', { method: 'GET' }),
  askQuery: (question, clarificationAnswer = null) =>
    request('/query', { method: 'POST', body: JSON.stringify({ question, clarificationAnswer }) }),
  executeQuery: (sql) => request('/query/execute', { method: 'POST', body: JSON.stringify({ sql }) }),
  resetQuery: () => request('/query/reset', { method: 'POST' }),
  getMe: () => request('/auth/me', { method: 'GET' }),
  signup: (data) => request('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  forgotPassword: (data) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify(data) }),
  resetPassword: (token, data) => request(`/auth/reset-password/${encodeURIComponent(token)}`, { method: 'POST', body: JSON.stringify(data) }),
  sendContact: (data) => request('/contact', { method: 'POST', body: JSON.stringify(data) })
};
