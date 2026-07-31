/** Tiny reactive store for the monitoring SPA */

const state = {
  config: null,
  auth: null,
  metrics: null,
  requests: null,
  filters: {
    search: '',
    method: '',
    status_code: '',
    path: '',
    has_error: false,
    min_latency: '',
    max_latency: ''
  },
  cursor: null,
  cursorStack: [],
  selectedId: null,
  selected: null,
  autoRefresh: true,
  loading: false,
  error: null
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(patch) {
  Object.assign(state, patch);
  for (const fn of listeners) fn(state);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function updateFilters(patch) {
  state.filters = { ...state.filters, ...patch };
  for (const fn of listeners) fn(state);
}