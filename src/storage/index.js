/**
 * @module storage
 * @description Public API for the storage subsystem.
 * Re-exports the factory, base strategy, and all concrete implementations.
 */

const StorageStrategy = require('./StorageStrategy');
const StorageFactory = require('./StorageFactory');
const MemoryStorage = require('./MemoryStorage');
const SqliteStorage = require('./SqliteStorage');
const PostgresStorage = require('./PostgresStorage');

module.exports = {
  StorageStrategy,
  StorageFactory,
  MemoryStorage,
  SqliteStorage,
  PostgresStorage
};
