/**
 * @module StorageFactory
 * @description Factory that creates the correct storage strategy instance
 * based on the configuration value. Implements the Factory Pattern.
 */

const MemoryStorage = require('./MemoryStorage');
const SqliteStorage = require('./SqliteStorage');
const PostgresStorage = require('./PostgresStorage');

/**
 * Valid storage strategy names.
 * @readonly
 * @enum {string}
 */
const STRATEGIES = {
  MEMORY: 'memory',
  SQLITE: 'sqlite',
  POSTGRESQL: 'postgresql'
};

/**
 * Creates the appropriate storage strategy based on configuration.
 *
 * @param {object} storageConfig - The storage section from logger.config.json
 * @param {string} storageConfig.strategy - One of 'memory', 'sqlite', 'postgresql'
 * @param {object} [storageConfig.config] - Strategy-specific configuration
 * @returns {import('./StorageStrategy')} A concrete storage strategy instance
 * @throws {Error} If the strategy name is not recognized
 *
 * @example
 * const storage = StorageFactory.create({
 *   strategy: 'sqlite',
 *   config: { database_path: './logs/api.db' }
 * });
 * await storage.initialize();
 */
class StorageFactory {
  /**
   * Create a storage strategy instance.
   * @param {object} storageConfig - Storage configuration
   * @returns {import('./StorageStrategy')} Storage instance
   */
  static create(storageConfig) {
    if (!storageConfig || !storageConfig.strategy) {
      throw new Error(
        'Storage configuration must include a "strategy" field. ' +
        `Valid values: ${Object.values(STRATEGIES).join(', ')}`
      );
    }

    const strategy = storageConfig.strategy.toLowerCase();
    const config = storageConfig.config || {};

    switch (strategy) {
      case STRATEGIES.MEMORY:
        return new MemoryStorage(config);

      case STRATEGIES.SQLITE:
        return new SqliteStorage(config);

      case STRATEGIES.POSTGRESQL:
        return new PostgresStorage(config);

      default:
        throw new Error(
          `Unknown storage strategy: "${storageConfig.strategy}". ` +
          `Valid values: ${Object.values(STRATEGIES).join(', ')}`
        );
    }
  }
}

/** @type {typeof STRATEGIES} */
StorageFactory.STRATEGIES = STRATEGIES;

module.exports = StorageFactory;
