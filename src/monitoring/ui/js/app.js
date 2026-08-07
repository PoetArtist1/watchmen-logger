import { api } from './api.js';
import { getState, setState, updateFilters } from './state.js';
import { currentRoute, navigate, apiBase } from './utils.js';
import { renderShell, setPageTitle } from './components/shell.js';
import { renderLogin } from './components/login.js';
import { renderDashboard, updateDashboard } from './components/dashboard.js';
import { renderRequestList, updateRequestList } from './components/requestList.js';
import { renderRequestDetail } from './components/requestDetail.js';
import { destroyAllCharts } from './components/charts.js';

const appRoot = document.getElementById('app');
let refreshTimer = null;
let bootstrapped = false;
let liveInFlight = false;

async function bootstrap() {
  try {
    const [config, auth] = await Promise.all([api.config(), api.me()]);
    setState({
      config,
      auth,
      autoRefresh: true,
      error: null
    });
    bootstrapped = true;
    await render();
    setupRefresh();
  } catch (err) {
    appRoot.innerHTML = `<div class="login-screen"><div class="login-panel"><p class="login-error">No se pudo iniciar el monitor: ${err.message}</p></div></div>`;
  }
}

/**
 * Poll metrics and patch the dashboard in place (no full remount / no flash).
 * Interval: config value, but at least every 5s for a live feel when enabled.
 */
function setupRefresh() {
  clearInterval(refreshTimer);
  const configured = Number(getState().config?.auto_refresh_interval) || 30;
  // Live stream: clamp to 3–5s when "live" is on so it feels realtime without hammering
  const seconds = Math.min(Math.max(Math.min(configured, 5), 3), 300);

  refreshTimer = setInterval(() => {
    void tickLive();
  }, seconds * 1000);
}

async function tickLive() {
  const { autoRefresh, auth, config } = getState();
  const route = currentRoute();
  if (!autoRefresh) return;
  if (config?.auth_enabled && !auth?.authenticated) return;
  if (!(route === '/' || route === '')) return;
  if (liveInFlight) return;

  liveInFlight = true;
  try {
    const metrics = await api.metrics({ live: true });
    setState({ metrics });
    const view = document.getElementById('view');
    if (view) updateDashboard(view, metrics);
    syncLiveChip();
  } catch {
    /* ignore transient poll errors */
  } finally {
    liveInFlight = false;
  }
}

function syncLiveChip() {
  const { autoRefresh } = getState();
  const chip = document.querySelector('.chip');
  const toggle = document.querySelector('[data-refresh-toggle]');
  if (chip) {
    chip.innerHTML = `
      <span class="chip__dot ${autoRefresh ? '' : 'is-paused'}"></span>
      live ${autoRefresh ? 'on' : 'paused'}
    `;
  }
  if (toggle) toggle.textContent = autoRefresh ? 'Pausar' : 'Reanudar';
}

async function loadMetrics() {
  const metrics = await api.metrics({ live: true });
  setState({ metrics });
}

async function loadRequests() {
  const { filters, cursor, config } = getState();
  const params = {
    limit: config?.page_size || 50,
    order: 'desc',
    cursor: cursor || undefined,
    search: filters.search || undefined,
    method: filters.method || undefined,
    status_code: filters.status_code || undefined,
    path: filters.path || undefined,
    min_latency: filters.min_latency || undefined,
    max_latency: filters.max_latency || undefined,
    has_error: filters.has_error ? 'true' : undefined
  };
  const requests = await api.requests(params);
  setState({ requests });
}

async function loadDetail(id) {
  try {
    const selected = await api.requestById(id);
    setState({ selectedId: id, selected, error: null });
  } catch (err) {
    setState({ selectedId: id, selected: null, error: err.message });
  }
}

async function render() {
  if (!bootstrapped) return;
  const state = getState();
  const route = currentRoute();
  const authEnabled = Boolean(state.config?.auth_enabled);

  if (authEnabled && !state.auth?.authenticated) {
    destroyAllCharts();
    renderLogin(appRoot, {
      error: state.error,
      onSubmit: async (username, password) => {
        try {
          await api.login(username, password);
          const auth = await api.me();
          setState({ auth, error: null });
          navigate('/');
          await render();
          setupRefresh();
        } catch (err) {
          setState({ error: err.message || 'Credenciales inválidas' });
          await render();
        }
      }
    });
    return;
  }

  const isDetail = /^\/requests\/[^/]+/.test(route);
  const baseRoute = isDetail ? '/requests' : (route || '/');

  renderShell(appRoot, {
    route: baseRoute,
    version: state.config?.version,
    autoRefresh: state.autoRefresh,
    authEnabled,
    onToggleRefresh: () => {
      setState({ autoRefresh: !getState().autoRefresh });
      syncLiveChip();
      if (getState().autoRefresh) void tickLive();
    },
    onLogout: async () => {
      await api.logout();
      setState({ auth: { authenticated: false, auth_enabled: true } });
      navigate('/login');
      await render();
    }
  });

  const view = document.getElementById('view');

  try {
    if (baseRoute === '/' || baseRoute === '') {
      setPageTitle('Observatory');
      if (!state.metrics) await loadMetrics();
      renderDashboard(view, getState().metrics);
    } else if (baseRoute.startsWith('/requests')) {
      setPageTitle('Traffic log');
      await loadRequests();
      const st = getState();

      const refreshList = async ({ syncFilters = false } = {}) => {
        await loadRequests();
        const next = getState();
        const patched = updateRequestList(view, {
          rows: next.requests?.data || [],
          pagination: next.requests?.pagination,
          filters: next.filters,
          canPrev: next.cursorStack.length > 0,
          syncFilters
        });
        if (!patched) await render();
      };

      renderRequestList(view, {
        rows: st.requests?.data || [],
        pagination: st.requests?.pagination,
        filters: st.filters,
        canPrev: st.cursorStack.length > 0,
        onApplyFilters: async (next) => {
          updateFilters(next);
          setState({ cursor: null, cursorStack: [] });
          await refreshList({ syncFilters: true });
        },
        onNext: async () => {
          const pag = getState().requests?.pagination;
          if (!pag?.has_more || !pag.next_cursor) return;
          setState({
            cursorStack: [...getState().cursorStack, getState().cursor],
            cursor: pag.next_cursor
          });
          await refreshList();
        },
        onPrev: async () => {
          const stack = [...getState().cursorStack];
          const prev = stack.pop() ?? null;
          setState({ cursorStack: stack, cursor: prev });
          await refreshList();
        }
      });
    }

    if (isDetail) {
      const id = route.split('/requests/')[1];
      await loadDetail(id);
      const host = document.createElement('div');
      appRoot.appendChild(host);
      renderRequestDetail(host, getState().selected, {
        onClose: () => {
          host.remove();
          navigate('/requests');
        }
      });
    }
  } catch (err) {
    if (err.status === 401) {
      setState({ auth: { authenticated: false, auth_enabled: true } });
      await render();
      return;
    }
    view.innerHTML = `<div class="empty">Error: ${err.message}</div>`;
  }
}

window.addEventListener('popstate', () => {
  if (bootstrapped) render();
});

console.info('[watchmen] monitor ready at', apiBase());
bootstrap();
