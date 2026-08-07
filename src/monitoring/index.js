/**
 * @module monitoring
 * @description Monitoring UI + metrics API (RF-03) — Integrante 2.
 */

const { createMonitoringRouter } = require('./createMonitoringRouter');
const { createAuthHandlers } = require('./auth');
const { createMetricsCache } = require('./metricsCache');
const { enrichMetrics } = require('./enrichMetrics');

module.exports = {
  createMonitoringRouter,
  createAuthHandlers,
  createMetricsCache,
  enrichMetrics
};
