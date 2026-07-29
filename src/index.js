/**
 * @module watchmen-logger
 * @description Main entry point for the watchmen-logger package.
 * Exports middleware, storage strategies, and the migration runner.
 *
 * @example
 * const { createCaptureMiddleware, StorageFactory } = require('watchmen-logger');
 *
 * const storage = StorageFactory.create({ strategy: 'sqlite', config: { database_path: './logs/app.db' } });
 * await storage.initialize();
 *
 * app.use(createCaptureMiddleware(storage, { excluded_paths: ['/health'] }));
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
  MigrationRunner
};
