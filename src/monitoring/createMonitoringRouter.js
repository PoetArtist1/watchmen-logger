/**
 * @module monitoring/createMonitoringRouter
 * @description Express router that serves the monitoring SPA + JSON APIs (RF-03).
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const { createAuthHandlers } = require('./auth');
const { createMetricsCache } = require('./metricsCache');
const { enrichMetrics } = require('./enrichMetrics');

/**
 * Parse multi-value query params (comma-separated or repeated keys).
 * @param {string|string[]|undefined} value
 * @returns {string[]|undefined}
 */
function parseList(value) {
  if (value == null || value === '') return undefined;
  const arr = Array.isArray(value) ? value : String(value).split(',');
  const cleaned = arr.map((v) => String(v).trim()).filter(Boolean);
  return cleaned.length ? cleaned : undefined;
}

/**
 * @param {import('../storage/StorageStrategy')} storage
 * @param {object} monitoringConfig - config.monitoring
 * @returns {import('express').Router}
 */
function createMonitoringRouter(storage, monitoringConfig = {}) {
  const router = express.Router();
  const uiRoot = path.join(__dirname, 'ui');
  const pageSize = Number(monitoringConfig.page_size) || 50;
  const maxPageSize = Number(monitoringConfig.max_page_size) || 200;
  const cache = monitoringConfig.cache_metrics !== false
    ? createMetricsCache(Number(monitoringConfig.cache_duration_seconds) || 30)
    : null;
  const auth = createAuthHandlers(monitoringConfig.auth || {});

  router.use(express.json({ limit: '32kb' }));
  router.use(auth.middleware);

  // ── Public UI config ───────────────────────────────────────────────
  router.get('/config', (_req, res) => {
    res.json({
      auth_enabled: Boolean(monitoringConfig.auth?.enabled),
      auto_refresh_interval: Number(monitoringConfig.auto_refresh_interval) || 30,
      page_size: pageSize,
      max_page_size: maxPageSize,
      version: require('../../package.json').version
    });
  });

  // ── Auth ───────────────────────────────────────────────────────────
  router.post('/auth/login', (req, res) => auth.login(req, res));
  router.post('/auth/logout', (req, res) => auth.logout(req, res));
  router.get('/auth/me', (req, res) => auth.me(req, res));

  // ── Metrics ────────────────────────────────────────────────────────
  router.get('/metrics', async (_req, res) => {
    try {
      if (cache) {
        const hit = cache.get();
        if (hit) return res.json(hit);
      }
      const raw = await storage.getMetrics();
      const metrics = await enrichMetrics(raw, storage);
      if (cache) cache.set(metrics);
      return res.json(metrics);
    } catch (err) {
      console.error('[watchmen-logger] metrics error:', err.message);
      return res.status(500).json({ error: 'Failed to compute metrics' });
    }
  });

  // ── Request list (cursor pagination + filters) ─────────────────────
  router.get('/requests', async (req, res) => {
    try {
      const q = req.query || {};
      const methods = parseList(q.method);
      const statusCodes = parseList(q.status_code)?.map(Number);

      const filters = {
        method: methods,
        status_code: statusCodes,
        path: q.path ? String(q.path) : undefined,
        search: q.search ? String(q.search) : undefined,
        start_date: q.start_date ? String(q.start_date) : undefined,
        end_date: q.end_date ? String(q.end_date) : undefined,
        has_error: q.has_error === 'true' || q.has_error === '1' ? true : undefined
      };

      if (q.min_latency != null && q.min_latency !== '') {
        filters.min_latency = Number(q.min_latency);
      }
      if (q.max_latency != null && q.max_latency !== '') {
        filters.max_latency = Number(q.max_latency);
      }

      // Drop undefined keys so storage filters stay clean
      for (const key of Object.keys(filters)) {
        if (filters[key] === undefined) delete filters[key];
      }

      let limit = Number(q.limit) || pageSize;
      if (Number.isNaN(limit) || limit < 1) limit = pageSize;
      limit = Math.min(limit, maxPageSize);

      const order = q.order === 'asc' ? 'asc' : 'desc';
      const result = await storage.findAll(filters, {
        cursor: q.cursor ? String(q.cursor) : undefined,
        limit,
        order
      });

      return res.json(result);
    } catch (err) {
      console.error('[watchmen-logger] requests list error:', err.message);
      return res.status(500).json({ error: 'Failed to list requests' });
    }
  });

  // ── Request detail ─────────────────────────────────────────────────
  router.get('/requests/:id', async (req, res) => {
    try {
      const record = await storage.findById(req.params.id);
      if (!record) {
        return res.status(404).json({ error: 'Request not found' });
      }
      return res.json(record);
    } catch (err) {
      console.error('[watchmen-logger] request detail error:', err.message);
      return res.status(500).json({ error: 'Failed to load request' });
    }
  });

  const indexHtmlPath = path.join(uiRoot, 'index.html');
  let indexTemplate = null;

  /**
   * Serve SPA with a correct <base href> so relative assets work
   * whether the mount has a trailing slash or not.
   */
  function sendSpa(req, res) {
    if (!indexTemplate) {
      indexTemplate = fs.readFileSync(indexHtmlPath, 'utf8');
    }
    const mount = `${req.baseUrl || ''}/`.replace(/\/{2,}/g, '/');
    const html = indexTemplate.includes('<base ')
      ? indexTemplate
      : indexTemplate.replace('<head>', `<head>\n  <base href="${mount}" />`);
    res.type('html').send(html);
  }

  // Prefer trailing slash for relative asset resolution
  router.get('/', (req, res) => {
    if (!req.originalUrl.endsWith('/') && !req.originalUrl.includes('?')) {
      return res.redirect(302, `${req.originalUrl}/`);
    }
    return sendSpa(req, res);
  });

  // ── Static SPA assets ──────────────────────────────────────────────
  router.use('/assets', express.static(uiRoot, {
    maxAge: '1h',
    index: false
  }));

  // SPA shell for client-side routes
  router.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/assets')) return next();
    return sendSpa(req, res);
  });

  return router;
}

module.exports = { createMonitoringRouter };
