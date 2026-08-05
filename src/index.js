/**
 * @module watchmen-logger
 * @description Main entry point for the watchmen-logger package.
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

const { loadConfiguration } = require('./config');
const { 
  setStorageEngine, 
  logInfo, 
  logWarning, 
  logError, 
  logDebug 
} = require('./utils/manualLogger');

module.exports = {
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

  // Gestor de Configuración (RF-06)
  loadConfiguration,

  // API de Logging Manual (RF-05)
  setStorageEngine,
  logInfo,
  logWarning,
  logError,
  logDebug
};