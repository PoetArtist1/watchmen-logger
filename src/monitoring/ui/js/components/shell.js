import { escapeHtml, navigate } from '../utils.js';

const icons = {
  dash: `<svg viewBox="0 0 24 24"><path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"/></svg>`,
  list: `<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
  out: `<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>`
};

/**
 * @param {HTMLElement} root
 * @param {object} opts
 */
export function renderShell(root, { route, version, autoRefresh, onToggleRefresh, onLogout, authEnabled }) {
  const activeDash = route === '/' || route === '';
  const activeList = route.startsWith('/requests');

  root.innerHTML = `
    <div class="shell">
      <aside class="rail" aria-label="Navegación">
        <div class="rail__brand">watch<span>men</span></div>
        <nav class="rail__nav">
          <a href="#" class="rail__link ${activeDash ? 'is-active' : ''}" data-nav="/" title="Dashboard">${icons.dash}</a>
          <a href="#" class="rail__link ${activeList ? 'is-active' : ''}" data-nav="/requests" title="Requests">${icons.list}</a>
          ${authEnabled ? `<button class="rail__link" data-logout title="Logout">${icons.out}</button>` : ''}
        </nav>
        <div class="rail__meta">v${escapeHtml(version || '1.0.0')}</div>
      </aside>
      <main class="stage">
        <header class="topbar">
          <div>
            <p class="topbar__kicker">signal desk</p>
            <h1 class="topbar__title" id="page-title">Observatory</h1>
          </div>
          <div class="topbar__actions">
            <span class="chip">
              <span class="chip__dot ${autoRefresh ? '' : 'is-paused'}"></span>
              live ${autoRefresh ? 'on' : 'paused'}
            </span>
            <button class="btn btn--ghost" type="button" data-refresh-toggle>
              ${autoRefresh ? 'Pausar' : 'Reanudar'}
            </button>
          </div>
        </header>
        <div id="view" class="view"></div>
      </main>
    </div>
  `;

  root.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(el.getAttribute('data-nav'));
    });
  });

  root.querySelector('[data-refresh-toggle]')?.addEventListener('click', onToggleRefresh);
  root.querySelector('[data-logout]')?.addEventListener('click', onLogout);
}

export function setPageTitle(title) {
  const el = document.getElementById('page-title');
  if (el) el.textContent = title;
}