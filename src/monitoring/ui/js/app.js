import { api } from './api.js';
import { getState, setState, updateFilters } from './state.js';
import { currentRoute, navigate, apiBase } from './utils.js';
import { renderShell, setPageTitle } from './components/shell.js';
import { renderLogin } from './components/login.js';
import { renderDashboard } from './components/dashboard.js';
import { renderRequestList } from './components/requestList.js';
import { renderRequestDetail } from './components/requestDetail.js';
import { destroyAllCharts } from './components/charts.js';

const appRoot = document.getElementById('app');
let refreshTimer = null;
let bootstrapped = false;

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

function setupRefresh() {
  clearInterval(refreshTimer);
  const seconds = Number(getState().config?.auto_refresh_interval) || 30;
  refreshTimer = setInterval(() => {
    const { autoRefresh, auth, config } = getState();
    const route = currentRoute();
    if (!autoRefresh) return;
    if (config?.auth_enabled && !auth?.authenticated) return;
    // Auto-refresh only on dashboard (RF-03)
    if (route === '/' || route === '') {
      loadMetrics().then(() => render()).catch(() => {});
    }
  }, Math.min(Math.max(seconds, 5), 300) * 1000);
}

async function loadMetrics() {
  const metrics = await api.metrics();
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

  // Detail routes keep the list underneath when possible
  const isDetail = /^\/requests\/[^/]+/.test(route);
  const baseRoute = isDetail ? '/requests' : (route || '/');

  renderShell(appRoot, {
    route: baseRoute,
    version: state.config?.version,
    autoRefresh: state.autoRefresh,
    authEnabled,
    onToggleRefresh: () => {
      setState({ autoRefresh: !getState().autoRefresh });
      render();
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
      renderRequestList(view, {
        rows: st.requests?.data || [],
        pagination: st.requests?.pagination,
        filters: st.filters,
        canPrev: st.cursorStack.length > 0,
        onApplyFilters: async (next) => {
          updateFilters(next);
          setState({ cursor: null, cursorStack: [] });
          await render();
        },
        onNext: async () => {
          const pag = getState().requests?.pagination;
          if (!pag?.has_more || !pag.next_cursor) return;
          setState({
            cursorStack: [...getState().cursorStack, getState().cursor],
            cursor: pag.next_cursor
          });
          await render();
        },
        onPrev: async () => {
          const stack = [...getState().cursorStack];
          const prev = stack.pop() ?? null;
          setState({ cursorStack: stack, cursor: prev });
          await render();
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

// Ensure we know the API mount even before base tag quirks
console.info('[watchmen] monitor ready at', apiBase());
bootstrap();
