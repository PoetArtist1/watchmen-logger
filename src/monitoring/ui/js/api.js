import { apiBase } from './utils.js';

async function request(path, options = {}) {
  const url = `${apiBase()}${path}`;
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  config: () => request('/config'),
  me: () => request('/auth/me'),
  login: (username, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  metrics: (opts = {}) => {
    const qs = opts.live ? '?live=1' : '';
    return request(`/metrics${qs}`);
  },
  requests: (params = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v == null || v === '') continue;
      if (Array.isArray(v)) qs.set(k, v.join(','));
      else qs.set(k, String(v));
    }
    const suffix = qs.toString() ? `?${qs}` : '';
    return request(`/requests${suffix}`);
  },
  requestById: (id) => request(`/requests/${encodeURIComponent(id)}`)
};
