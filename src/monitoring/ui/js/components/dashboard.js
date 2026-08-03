import { escapeHtml, formatTime, formatUptime, methodClass, navigate } from '../utils.js';
import { renderMethodChart, renderStatusChart, renderTimelineChart, destroyAllCharts } from './charts.js';

function rankItems(rows, valueKey) {
  if (!rows?.length) return `<div class="empty">Sin datos todavía</div>`;
  return `<ol class="rank-list">${rows.slice(0, 8).map((row, i) => `
    <li>
      <span class="rank-list__idx">${String(i + 1).padStart(2, '0')}</span>
      <span class="rank-list__path" title="${escapeHtml(row.path)}">${escapeHtml(row.path)}</span>
      <span class="rank-list__val">${escapeHtml(row[valueKey])}${valueKey === 'avg_latency' ? ' ms' : ''}</span>
    </li>
  `).join('')}</ol>`;
}

function renderErrors(rows) {
  if (!rows?.length) return `<div class="empty">Sin errores recientes</div>`;
  return `<div class="error-feed">${rows.slice(0, 8).map((row) => `
    <button type="button" class="error-feed__item" data-open-id="${escapeHtml(row.request_id)}">
      <span class="${methodClass(row.method)}">${escapeHtml(row.method)}</span>
      <div>
        <p class="error-feed__path">${escapeHtml(row.path)}</p>
        <p class="error-feed__msg">${escapeHtml(row.error_message || `HTTP ${row.status_code}`)}</p>
      </div>
      <span class="mono muted" style="font-size:.68rem">${escapeHtml(formatTime(row.timestamp))}</span>
    </button>
  `).join('')}</div>`;
}

function bindErrorClicks(root) {
  root.querySelectorAll('[data-open-id]').forEach((el) => {
    el.addEventListener('click', () => navigate(`/requests/${el.getAttribute('data-open-id')}`));
  });
}

function setText(root, selector, value) {
  const el = root.querySelector(selector);
  if (!el) return;
  const next = String(value ?? '');
  if (el.textContent !== next) {
    el.textContent = next;
    el.classList.add('is-live-tick');
    window.setTimeout(() => el.classList.remove('is-live-tick'), 420);
  }
}

/**
 * Full mount (first paint / route enter).
 */
export function renderDashboard(root, metrics) {
  destroyAllCharts();
  const m = metrics || {};
  const req = m.requests || {};
  const perf = m.performance || {};
  const err = m.errors || {};
  const sys = m.system || {};
  const errorsTotal = (err.total_4xx || 0) + (err.total_5xx || 0);

  root.innerHTML = `
    <section class="dash" data-dashboard>
      <div class="metrics-strip">
        <article class="metric-block metric-block--hero">
          <p class="metric-block__label">Total requests</p>
          <p class="metric-block__value" data-m="total">${escapeHtml(req.total ?? 0)}</p>
          <p class="metric-block__hint" data-m="hero-hint">${escapeHtml(sys.storage_strategy || 'storage')} · uptime ${escapeHtml(formatUptime(sys.uptime_seconds))}</p>
          <span class="metric-block__slash" aria-hidden="true"></span>
        </article>
        <article class="metric-block">
          <p class="metric-block__label">Tasa / min</p>
          <p class="metric-block__value" data-m="rate">${escapeHtml(req.rate_per_minute ?? 0)}</p>
          <p class="metric-block__hint">ventana móvil 60s</p>
        </article>
        <article class="metric-block">
          <p class="metric-block__label">Errores</p>
          <p class="metric-block__value" data-m="errors">${escapeHtml(errorsTotal)}</p>
          <p class="metric-block__hint" data-m="errors-hint">4xx ${escapeHtml(err.total_4xx || 0)} · 5xx ${escapeHtml(err.total_5xx || 0)}</p>
        </article>
        <article class="metric-block">
          <p class="metric-block__label">Latencia avg</p>
          <p class="metric-block__value" data-m="latency">${escapeHtml(perf.avg ?? 0)}<span style="font-size:.45em">ms</span></p>
          <p class="metric-block__hint" data-m="latency-hint">p95 ${escapeHtml(perf.p95 ?? 0)} · p99 ${escapeHtml(perf.p99 ?? 0)}</p>
        </article>
      </div>

      <div class="panel-grid">
        <section class="panel">
          <div class="panel__head">
            <h2 class="panel__title">Timeline · última hora</h2>
            <span class="muted mono">req + latency</span>
          </div>
          <div class="panel__body panel__body--chart">
            <canvas id="chart-timeline"></canvas>
          </div>
        </section>
        <section class="panel">
          <div class="panel__head">
            <h2 class="panel__title">Métodos</h2>
          </div>
          <div class="panel__body panel__body--chart">
            <canvas id="chart-method"></canvas>
          </div>
        </section>
        <section class="panel">
          <div class="panel__head">
            <h2 class="panel__title">Status</h2>
          </div>
          <div class="panel__body panel__body--chart">
            <canvas id="chart-status"></canvas>
          </div>
        </section>
        <section class="panel">
          <div class="panel__head">
            <h2 class="panel__title">Top endpoints</h2>
          </div>
          <div class="panel__body" data-m="top">${rankItems(m.top_endpoints, 'count')}</div>
        </section>
        <section class="panel">
          <div class="panel__head">
            <h2 class="panel__title">Más lentos</h2>
          </div>
          <div class="panel__body" data-m="slow">${rankItems(m.slowest_endpoints, 'avg_latency')}</div>
        </section>
        <section class="panel">
          <div class="panel__head">
            <h2 class="panel__title">Errores recientes</h2>
          </div>
          <div class="panel__body" data-m="recent">${renderErrors(m.recent_errors)}</div>
        </section>
      </div>
    </section>
  `;

  requestAnimationFrame(() => {
    renderTimelineChart(root.querySelector('#chart-timeline'), m.timeline || []);
    renderMethodChart(root.querySelector('#chart-method'), req.by_method || {});
    renderStatusChart(root.querySelector('#chart-status'), req.by_status || {});
  });

  bindErrorClicks(root);
}

/**
 * Live patch — updates numbers/lists/charts without remounting the view (no flash).
 */
export function updateDashboard(root, metrics) {
  if (!root?.querySelector('[data-dashboard]')) {
    renderDashboard(root, metrics);
    return;
  }

  const m = metrics || {};
  const req = m.requests || {};
  const perf = m.performance || {};
  const err = m.errors || {};
  const sys = m.system || {};
  const errorsTotal = (err.total_4xx || 0) + (err.total_5xx || 0);

  setText(root, '[data-m="total"]', req.total ?? 0);
  setText(root, '[data-m="rate"]', req.rate_per_minute ?? 0);
  setText(root, '[data-m="errors"]', errorsTotal);
  setText(
    root,
    '[data-m="hero-hint"]',
    `${sys.storage_strategy || 'storage'} · uptime ${formatUptime(sys.uptime_seconds)}`
  );
  setText(
    root,
    '[data-m="errors-hint"]',
    `4xx ${err.total_4xx || 0} · 5xx ${err.total_5xx || 0}`
  );

  const latencyEl = root.querySelector('[data-m="latency"]');
  if (latencyEl) {
    const next = `${perf.avg ?? 0}`;
    const span = latencyEl.querySelector('span');
    if (latencyEl.childNodes[0]?.textContent !== next) {
      latencyEl.childNodes[0].textContent = next;
      latencyEl.classList.add('is-live-tick');
      window.setTimeout(() => latencyEl.classList.remove('is-live-tick'), 420);
    }
    if (!span) {
      latencyEl.insertAdjacentHTML('beforeend', '<span style="font-size:.45em">ms</span>');
    }
  }
  setText(
    root,
    '[data-m="latency-hint"]',
    `p95 ${perf.p95 ?? 0} · p99 ${perf.p99 ?? 0}`
  );

  const top = root.querySelector('[data-m="top"]');
  if (top) top.innerHTML = rankItems(m.top_endpoints, 'count');
  const slow = root.querySelector('[data-m="slow"]');
  if (slow) slow.innerHTML = rankItems(m.slowest_endpoints, 'avg_latency');
  const recent = root.querySelector('[data-m="recent"]');
  if (recent) {
    recent.innerHTML = renderErrors(m.recent_errors);
    bindErrorClicks(recent);
  }

  renderTimelineChart(root.querySelector('#chart-timeline'), m.timeline || []);
  renderMethodChart(root.querySelector('#chart-method'), req.by_method || {});
  renderStatusChart(root.querySelector('#chart-status'), req.by_status || {});
}
