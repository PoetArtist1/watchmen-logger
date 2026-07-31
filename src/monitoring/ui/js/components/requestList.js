import {
  escapeHtml,
  formatTime,
  methodClass,
  navigate,
  statusClass
} from '../utils.js';

export function renderRequestList(root, {
  rows,
  pagination,
  filters,
  onApplyFilters,
  onNext,
  onPrev,
  canPrev
}) {
  root.innerHTML = `
    <section>
      <form class="filters" id="filters-form">
        <div class="field field--wide">
          <label for="search">Buscar path / id</label>
          <input id="search" name="search" value="${escapeHtml(filters.search)}" placeholder="users, uuid..." />
        </div>
        <div class="field">
          <label for="method">Método</label>
          <select id="method" name="method">
            ${methodOptions(filters.method)}
          </select>
        </div>
        <div class="field">
          <label for="status_code">Status</label>
          <input id="status_code" name="status_code" value="${escapeHtml(filters.status_code)}" placeholder="404,500" />
        </div>
        <div class="field">
          <label for="path">Path</label>
          <input id="path" name="path" value="${escapeHtml(filters.path)}" placeholder="/api" />
        </div>
        <div class="field">
          <label for="min_latency">Lat min</label>
          <input id="min_latency" name="min_latency" type="number" min="0" value="${escapeHtml(filters.min_latency)}" />
        </div>
        <div class="field">
          <label for="max_latency">Lat max</label>
          <input id="max_latency" name="max_latency" type="number" min="0" value="${escapeHtml(filters.max_latency)}" />
        </div>
        <div class="field">
          <label for="has_error">Solo errores</label>
          <select id="has_error" name="has_error">
            <option value="false" ${!filters.has_error ? 'selected' : ''}>No</option>
            <option value="true" ${filters.has_error ? 'selected' : ''}>Sí</option>
          </select>
        </div>
        <div class="filters__actions">
          <button class="btn btn--ghost" type="reset">Limpiar</button>
          <button class="btn" type="submit">Filtrar</button>
        </div>
      </form>

      <div class="table-wrap">
        <table class="req-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Method</th>
              <th>Path</th>
              <th>Status</th>
              <th>Latency</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            ${(rows || []).length ? rows.map(rowHtml).join('') : `
              <tr><td colspan="6"><div class="empty">No hay requests con estos filtros</div></td></tr>
            `}
          </tbody>
        </table>
      </div>

      <div class="pager">
        <span class="pager__info">
          ${escapeHtml(pagination?.total_count ?? 0)} total
          ${pagination?.has_more ? ' · hay más' : ''}
        </span>
        <div style="display:flex;gap:.5rem">
          <button class="btn btn--ghost" type="button" data-prev ${canPrev ? '' : 'disabled'}>Anterior</button>
          <button class="btn" type="button" data-next ${pagination?.has_more ? '' : 'disabled'}>Siguiente</button>
        </div>
      </div>
    </section>
  `;

  const form = root.querySelector('#filters-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    onApplyFilters({
      search: String(fd.get('search') || ''),
      method: String(fd.get('method') || ''),
      status_code: String(fd.get('status_code') || ''),
      path: String(fd.get('path') || ''),
      min_latency: String(fd.get('min_latency') || ''),
      max_latency: String(fd.get('max_latency') || ''),
      has_error: String(fd.get('has_error')) === 'true'
    });
  });
  form.addEventListener('reset', () => {
    setTimeout(() => {
      onApplyFilters({
        search: '',
        method: '',
        status_code: '',
        path: '',
        min_latency: '',
        max_latency: '',
        has_error: false
      });
    }, 0);
  });

  root.querySelector('[data-next]')?.addEventListener('click', onNext);
  root.querySelector('[data-prev]')?.addEventListener('click', onPrev);
  root.querySelectorAll('[data-id]').forEach((tr) => {
    tr.addEventListener('click', () => navigate(`/requests/${tr.getAttribute('data-id')}`));
  });
}

function rowHtml(row) {
  return `
    <tr data-id="${escapeHtml(row.request_id)}">
      <td class="mono" style="font-size:.78rem">${escapeHtml(formatTime(row.timestamp))}</td>
      <td><span class="${methodClass(row.method)}">${escapeHtml(row.method)}</span></td>
      <td class="mono" style="font-size:.8rem">${escapeHtml(row.path)}</td>
      <td class="${statusClass(row.status_code)}">${escapeHtml(row.status_code)}</td>
      <td class="mono">${escapeHtml(row.latency_ms ?? 0)} ms</td>
      <td class="mono muted" style="font-size:.75rem">${escapeHtml(row.client_ip || '—')}</td>
    </tr>
  `;
}

function methodOptions(selected) {
  const methods = ['', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
  return methods.map((m) => `
    <option value="${m}" ${selected === m ? 'selected' : ''}>${m || 'Todos'}</option>
  `).join('');
}