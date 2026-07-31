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

export function renderDashboard(root, metrics) {
  destroyAllCharts();
  const m = metrics || {};
  const req = m.requests || {};
  const perf = m.performance || {};
  const err = m.errors || {};
  const sys = m.system || {};
  const errorsTotal = (err.total_4xx || 0) + (err.total_5xx || 0);

  root.innerHTML = `
    <section class="dash">
      <div class="metrics-strip">
        <article class="metric-block metric-block--hero">
          <p class="metric-block__label">Total requests</p>
          <p class="metric-block__value">${escapeHtml(req.total ?? 0)}</p>
          <p class="metric-block__hint">${escapeHtml(sys.storage_strategy || 'storage')} · uptime ${escapeHtml(formatUptime(sys.uptime_seconds))}</p>
          <span class="metric-block__slash" aria-hidden="true"></span>
        </article>
        <article class="metric-block">
          <p class="metric-block__label">Tasa / min</p>
          <p class="metric-block__value">${escapeHtml(req.rate_per_minute ?? 0)}</p>
          <p class="metric-block__hint">ventana móvil 60s</p>
        </article>
        <article class="metric-block">
          <p class="metric-block__label">Errores</p>
          <p class="metric-block__value">${escapeHtml(errorsTotal)}</p>
          <p class="metric-block__hint">4xx ${escapeHtml(err.total_4xx || 0)} · 5xx ${escapeHtml(err.total_5xx || 0)}</p>
        </article>
        <article class="metric-block">
          <p class="metric-block__label">Latencia avg</p>
          <p class="metric-block__value">${escapeHtml(perf.avg ?? 0)}<span style="font-size:.45em">ms</span></p>
          <p class="metric-block__hint">p95 ${escapeHtml(perf.p95 ?? 0)} · p99 ${escapeHtml(perf.p99 ?? 0)}</p>
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
          <div class="panel__body">
            ${rankItems(m.top_endpoints, 'count')}
          </div>
        </section>
        <section class="panel">
          <div class="panel__head">
            <h2 class="panel__title">Más lentos</h2>
          </div>
          <div class="panel__body">
            ${rankItems(m.slowest_endpoints, 'avg_latency')}
          </div>
        </section>
        <section class="panel">
          <div class="panel__head">
            <h2 class="panel__title">Errores recientes</h2>
          </div>
          <div class="panel__body">
            ${renderErrors(m.recent_errors)}
          </div>
        </section>
      </div>
    </section>
  `;

  requestAnimationFrame(() => {
    renderTimelineChart(root.querySelector('#chart-timeline'), m.timeline || []);
    renderMethodChart(root.querySelector('#chart-method'), req.by_method || {});
    renderStatusChart(root.querySelector('#chart-status'), req.by_status || {});
  });

  root.querySelectorAll('[data-open-id]').forEach((el) => {
    el.addEventListener('click', () => navigate(`/requests/${el.getAttribute('data-open-id')}`));
  });
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