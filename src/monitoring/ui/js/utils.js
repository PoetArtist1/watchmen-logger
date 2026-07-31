/** Shared UI helpers */

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatUptime(seconds = 0) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function statusClass(code) {
  const group = `${Math.floor(Number(code) / 100)}xx`;
  return `status status--${group}`;
}

export function methodClass(method) {
  const m = String(method || 'get').toLowerCase();
  return `badge badge--${m}`;
}

export function prettyJson(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function pairsFromObject(obj) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj);
}

/**
 * Resolve API base from <base href> (injected by the router) or the URL path.
 */
export function apiBase() {
  const baseEl = document.querySelector('base');
  if (baseEl?.href) {
    try {
      return new URL(baseEl.href).pathname.replace(/\/+$/, '') || '/api/monitoring';
    } catch {
      /* fall through */
    }
  }
  const path = window.location.pathname.replace(/\/+$/, '');
  const cleaned = path
    .replace(/\/requests\/[^/]+$/, '')
    .replace(/\/requests$/, '')
    .replace(/\/login$/, '');
  return cleaned || '/api/monitoring';
}

export function navigate(path) {
  const base = apiBase();
  const next = path.startsWith('/') ? `${base}${path === '/' ? '' : path}` : `${base}/${path}`;
  window.history.pushState({}, '', next || base);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function currentRoute() {
  const base = apiBase();
  let rest = window.location.pathname.slice(base.length) || '/';
  if (!rest.startsWith('/')) rest = `/${rest}`;
  return rest;
}