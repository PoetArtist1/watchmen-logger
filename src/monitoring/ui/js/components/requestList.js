import {
  escapeHtml,
  formatClientAddress,
  formatTime,
  methodClass,
  navigate,
  statusClass
} from '../utils.js';

function rowHtml(row) {
  return `
    <tr data-id="${escapeHtml(row.request_id)}">
      <td class="mono" style="font-size:.78rem">${escapeHtml(formatTime(row.timestamp))}</td>
      <td><span class="${methodClass(row.method)}">${escapeHtml(row.method)}</span></td>
      <td class="mono" style="font-size:.8rem">${escapeHtml(row.path)}</td>
      <td class="${statusClass(row.status_code)}">${escapeHtml(row.status_code)}</td>
      <td class="mono">${escapeHtml(row.latency_ms ?? 0)} ms</td>
      <td class="mono muted" style="font-size:.75rem">${escapeHtml(formatClientAddress(row.client_ip, row.client_port))}</td>
    </tr>
  `;
}

function tbodyHtml(rows) {
  if (!(rows || []).length) {
    return `<tr><td colspan="6"><div class="empty">No hay requests con estos filtros</div></td></tr>`;
  }
  return rows.map(rowHtml).join('');
}

function pagerInfo(pagination) {
  return `${pagination?.total_count ?? 0} total${pagination?.has_more ? ' · hay más' : ''}`;
}

function methodOptions(selected) {
  const methods = ['', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
  return methods.map((m) => `
    <option value="${m}" ${selected === m ? 'selected' : ''}>${m || 'Todos'}</option>
  `).join('');
}

function statusOptions(selected) {
  const options = [
    { value: '', label: 'Todos' },
    { value: '2xx', label: '2xx · Éxito' },
    { value: '3xx', label: '3xx · Redirect' },
    { value: '4xx', label: '4xx · Cliente' },
    { value: '5xx', label: '5xx · Servidor' },
    { value: '200', label: '200 OK' },
    { value: '201', label: '201 Created' },
    { value: '204', label: '204 No Content' },
    { value: '301', label: '301 Moved' },
    { value: '302', label: '302 Found' },
    { value: '400', label: '400 Bad Request' },
    { value: '401', label: '401 Unauthorized' },
    { value: '403', label: '403 Forbidden' },
    { value: '404', label: '404 Not Found' },
    { value: '422', label: '422 Unprocessable' },
    { value: '500', label: '500 Internal Error' },
    { value: '502', label: '502 Bad Gateway' },
    { value: '503', label: '503 Unavailable' }
  ];
  return options.map((o) => `
    <option value="${o.value}" ${String(selected || '') === o.value ? 'selected' : ''}>${o.label}</option>
  `).join('');
}

function bindRowClicks(root) {
  root.querySelectorAll('tr[data-id]').forEach((tr) => {
    tr.addEventListener('click', () => navigate(`/requests/${tr.getAttribute('data-id')}`));
  });
}

function bindPager(root, { onNext, onPrev }) {
  root.querySelector('[data-next]')?.addEventListener('click', onNext);
  root.querySelector('[data-prev]')?.addEventListener('click', onPrev);
}

/**
 * Patch table + pager without remounting the filter form (no flash).
 */
export function updateRequestList(root, {
  rows,
  pagination,
  canPrev,
  filters,
  syncFilters = false
}) {
  const section = root.querySelector('[data-request-list]');
  if (!section) return false;

  const tbody = root.querySelector('[data-m="tbody"]');
  if (tbody) {
    tbody.innerHTML = tbodyHtml(rows);
    bindRowClicks(tbody);
  }

  const info = root.querySelector('[data-m="pager-info"]');
  if (info) info.textContent = pagerInfo(pagination);

  const prev = root.querySelector('[data-prev]');
  const next = root.querySelector('[data-next]');
  if (prev) prev.disabled = !canPrev;
  if (next) next.disabled = !pagination?.has_more;

  if (syncFilters) {
    const form = root.querySelector('#filters-form');
    if (form) {
      form.search.value = filters.search || '';
      form.method.value = filters.method || '';
      form.status_code.value = filters.status_code || '';
      form.path.value = filters.path || '';
      form.min_latency.value = filters.min_latency || '';
      form.max_latency.value = filters.max_latency || '';
      form.has_error.value = filters.has_error ? 'true' : 'false';
    }
  }

  return true;
}

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
    <section data-request-list>
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
          <select id="status_code" name="status_code">
            ${statusOptions(filters.status_code)}
          </select>
        </div>
        <div class="field">
          <label for="path">Path</label>
          <input id="path" name="path" value="${escapeHtml(filters.path)}" placeholder="ej. users" />
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
              <th>IP:Puerto</th>
            </tr>
          </thead>
          <tbody data-m="tbody">
            ${tbodyHtml(rows)}
          </tbody>
        </table>
      </div>

      <div class="pager">
        <span class="pager__info" data-m="pager-info">
          ${escapeHtml(pagerInfo(pagination))}
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
  form.addEventListener('reset', (e) => {
    e.preventDefault();
    form.reset();
    // Force empty selects after native-like clear
    form.search.value = '';
    form.method.value = '';
    form.status_code.value = '';
    form.path.value = '';
    form.min_latency.value = '';
    form.max_latency.value = '';
    form.has_error.value = 'false';
    onApplyFilters({
      search: '',
      method: '',
      status_code: '',
      path: '',
      min_latency: '',
      max_latency: '',
      has_error: false
    });
  });

  bindPager(root, { onNext, onPrev });
  bindRowClicks(root.querySelector('[data-m="tbody"]'));
}
