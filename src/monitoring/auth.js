/**
 * @module monitoring/auth
 * @description Lightweight session auth for the monitoring UI (RF-03).
 * Cookie-based HMAC sessions — no JWT / OAuth.
 */

const crypto = require('crypto');

const COOKIE_NAME = 'wm_monitor_session';

/**
 * @param {object} authConfig - monitoring.auth from logger.config.json
 * @returns {{ required: boolean, middleware: Function, login: Function, logout: Function, me: Function }}
 */
function createAuthHandlers(authConfig = {}) {
  const enabled = Boolean(authConfig.enabled);
  const username = authConfig.username || '';
  const password = authConfig.password || '';
  const timeoutHours = Number(authConfig.session_timeout_hours) || 1;
  const secret = crypto
    .createHash('sha256')
    .update(`watchmen:${username}:${password}`)
    .digest('hex');

  /**
   * @param {string} user
   * @returns {string}
   */
  function issueToken(user) {
    const exp = Date.now() + timeoutHours * 60 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({ u: user, exp }), 'utf8').toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    return `${payload}.${sig}`;
  }

  /**
   * @param {string} token
   * @returns {{ u: string, exp: number }|null}
   */
  function verifyToken(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;
    const [payload, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (!data.exp || Date.now() > data.exp) return null;
      return data;
    } catch {
      return null;
    }
  }

  /**
   * @param {import('express').Request} req
   * @returns {string|null}
   */
  function readCookie(req) {
    const header = req.headers.cookie;
    if (!header) return null;
    const parts = header.split(';');
    for (const part of parts) {
      const [k, ...rest] = part.trim().split('=');
      if (k === COOKIE_NAME) return decodeURIComponent(rest.join('='));
    }
    return null;
  }

  /**
   * @param {import('express').Response} res
   * @param {string} token
   */
  function setSessionCookie(res, token) {
    const maxAge = Math.floor(timeoutHours * 60 * 60);
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
    );
  }

  /**
   * @param {import('express').Response} res
   */
  function clearSessionCookie(res) {
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
    );
  }

  /**
   * Protect API + UI when auth is enabled.
   * Allows unauthenticated access to login page assets and auth endpoints.
   */
  function middleware(req, res, next) {
    if (!enabled) return next();

    const openPaths = new Set([
      '/auth/login',
      '/auth/logout',
      '/auth/me',
      '/config'
    ]);
    if (openPaths.has(req.path)) return next();

    // Static assets + SPA shell are public; SPA handles login gate client-side.
    // API data routes require a valid session.
    const isApiData =
      req.path === '/metrics'
      || req.path === '/requests'
      || req.path.startsWith('/requests/');

    if (!isApiData) return next();

    const token = readCookie(req);
    const session = verifyToken(token);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' });
    }
    req.monitorUser = session.u;
    return next();
  }

  function login(req, res) {
    if (!enabled) {
      return res.json({ ok: true, auth_enabled: false });
    }
    const body = req.body || {};
    const user = String(body.username || '');
    const pass = String(body.password || '');
    if (user !== username || pass !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = issueToken(user);
    setSessionCookie(res, token);
    return res.json({ ok: true, username: user });
  }

  function logout(_req, res) {
    clearSessionCookie(res);
    return res.json({ ok: true });
  }

  function me(req, res) {
    if (!enabled) {
      return res.json({ authenticated: true, auth_enabled: false, username: null });
    }
    const session = verifyToken(readCookie(req));
    if (!session) {
      return res.json({ authenticated: false, auth_enabled: true, username: null });
    }
    return res.json({ authenticated: true, auth_enabled: true, username: session.u });
  }

  return {
    required: enabled,
    middleware,
    login,
    logout,
    me
  };
}

module.exports = { createAuthHandlers, COOKIE_NAME };
