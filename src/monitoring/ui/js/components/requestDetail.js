import {
  escapeHtml,
  formatClientAddress,
  formatTime,
  methodClass,
  pairsFromObject,
  prettyJson,
  statusClass
} from '../utils.js';

export function renderRequestDetail(root, record, { onClose }) {
  if (!record) {
    root.innerHTML = `
      <div class="drawer-backdrop" data-close>
        <aside class="drawer">
          <div class="empty">Request no encontrada</div>
          <button class="btn btn--ghost" type="button" data-close style="margin-top:1rem">Cerrar</button>
        </aside>
      </div>
    `;
    bindClose(root, onClose);
    return;
  }

  const reqHeaders = pairsFromObject(record.request_headers);
  const resHeaders = pairsFromObject(record.response_headers);
  const query = pairsFromObject(record.request_query);

  root.innerHTML = `
    <div class="drawer-backdrop" data-close>
      <aside class="drawer" role="dialog" aria-modal="true" aria-label="Detalle de request">
        <div class="drawer__top">
          <div>
            <h2 class="drawer__title">
              <span class="${methodClass(record.method)}">${escapeHtml(record.method)}</span>
              <span class="${statusClass(record.status_code)}" style="margin-left:.4rem">${escapeHtml(record.status_code)}</span>
            </h2>
            <p class="drawer__id">${escapeHtml(record.request_id)}</p>
          </div>
          <button class="btn btn--ghost" type="button" data-close>Cerrar</button>
        </div>

        <div class="kv-grid">
          <div class="kv"><span class="kv__k">Path</span><span class="kv__v mono">${escapeHtml(record.path)}</span></div>
          <div class="kv"><span class="kv__k">Timestamp</span><span class="kv__v">${escapeHtml(formatTime(record.timestamp))}</span></div>
          <div class="kv"><span class="kv__k">Latency</span><span class="kv__v">${escapeHtml(record.latency_ms ?? 0)} ms</span></div>
          <div class="kv"><span class="kv__k">Response size</span><span class="kv__v">${escapeHtml(record.response_size_bytes ?? 0)} B</span></div>
          <div class="kv"><span class="kv__k">Client</span><span class="kv__v mono">${escapeHtml(formatClientAddress(record.client_ip, record.client_port))}</span></div>
          <div class="kv"><span class="kv__k">User agent</span><span class="kv__v" style="font-size:.8rem">${escapeHtml(record.user_agent || '—')}</span></div>
        </div>

        <div class="section">
          <h3>Full URL</h3>
          <pre class="codeblock">${escapeHtml(record.full_url || record.path)}</pre>
        </div>

        <div class="section">
          <h3>Query params</h3>
          ${tablePairs(query)}
        </div>

        <div class="section">
          <h3>Request headers</h3>
          ${tablePairs(reqHeaders)}
        </div>

        <div class="section">
          <h3>Request body</h3>
          <pre class="codeblock">${escapeHtml(prettyJson(record.request_body))}</pre>
        </div>

        <div class="section">
          <h3>Response headers</h3>
          ${tablePairs(resHeaders)}
        </div>

        <div class="section">
          <h3>Response body</h3>
          <pre class="codeblock">${escapeHtml(prettyJson(record.response_body))}</pre>
        </div>

        ${record.error_message || record.stack_trace ? `
          <div class="section">
            <h3>Error</h3>
            <pre class="codeblock">${escapeHtml(record.error_message || '')}${record.stack_trace ? `\n\n${escapeHtml(record.stack_trace)}` : ''}</pre>
          </div>
        ` : ''}
      </aside>
    </div>
  `;

  bindClose(root, onClose);
  root.querySelector('.drawer')?.addEventListener('click', (e) => e.stopPropagation());
}

function tablePairs(pairs) {
  if (!pairs.length) return `<div class="empty">Vacío</div>`;
  return `
    <table class="pair-table">
      <tbody>
        ${pairs.map(([k, v]) => `
          <tr>
            <th>${escapeHtml(k)}</th>
            <td class="mono">${escapeHtml(typeof v === 'object' ? prettyJson(v) : v)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function bindClose(root, onClose) {
  root.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', onClose);
  });
}