/**
 * @module watchmen-logger
 * @description Main entry point for the watchmen-logger package.
 *
 * Provides:
 * - {@link createLogger} — bootstrap from `logger.config.json` + `.env` (RF-01, RF-06)
 * - Manual logging API via {@link WatchmenLogger} (`logInfo`, `logWarning`, `logError`, `logDebug`) (RF-05)
 * - Capture middleware, storage strategies, config helpers and utilities
 *
 * @example
 * const { createLogger } = require('watchmen-logger');
 *
 * async function main(app) {
 *   const logger = await createLogger();
 *   app.use(logger.middleware());
 *   await logger.logInfo('API ready', { port: 3000 });
 * }
 */

const { createCaptureMiddleware } = require('./middleware');
const {
  StorageStrategy,
  StorageFactory,
  MemoryStorage,
  SqliteStorage,
  PostgresStorage
} = require('./storage');
const { MigrationRunner } = require('./migrations');
const {
  loadConfig,
  loadEnv,
  validateConfig,
  DEFAULT_CONFIG
} = require('./config');
const {
  generateUuid,
  nowISO8601,
  toISO8601,
  isISO8601,
  maskHeaders,
  maskSensitiveData,
  REDACTED
} = require('./utils');
const { WatchmenLogger, createLogger, LOG_LEVELS } = require('./Logger');
const {
  createMonitoringRouter,
  createAuthHandlers,
  createMetricsCache,
  enrichMetrics
} = require('./monitoring');

module.exports = {
  // High-level API (RF-01 / RF-05 / RF-06)
  createLogger,
  WatchmenLogger,
  LOG_LEVELS,

  // Monitoring UI + APIs (RF-03)
  createMonitoringRouter,
  createAuthHandlers,
  createMetricsCache,
  enrichMetrics,

  // Middleware
  createCaptureMiddleware,

  // Storage
  StorageStrategy,
  StorageFactory,
  MemoryStorage,
  SqliteStorage,
  PostgresStorage,

  // Migrations
  MigrationRunner,

  // Config
  loadConfig,
  loadEnv,
  validateConfig,
  DEFAULT_CONFIG,

  // Utils
  generateUuid,
  nowISO8601,
  toISO8601,
  isISO8601,
  maskHeaders,
  maskSensitiveData,
  REDACTED
};
