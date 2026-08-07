import { escapeHtml } from '../utils.js';

export function renderLogin(root, { error, onSubmit }) {
  root.innerHTML = `
    <div class="login-screen">
      <form class="login-panel" id="login-form">
        <h1 class="login-panel__brand">watch<span>men</span></h1>
        <p class="login-panel__sub">Acceso al signal desk. Credenciales del bloque <span class="mono">monitoring.auth</span>.</p>
        ${error ? `<p class="login-error">${escapeHtml(error)}</p>` : ''}
        <div class="field">
          <label for="username">Usuario</label>
          <input id="username" name="username" autocomplete="username" required />
        </div>
        <div class="field">
          <label for="password">Contraseña</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required />
        </div>
        <button class="btn btn--signal" type="submit">Entrar</button>
      </form>
    </div>
  `;

  root.querySelector('#login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit(String(fd.get('username') || ''), String(fd.get('password') || ''));
  });
}