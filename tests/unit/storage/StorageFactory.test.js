/**
 * @file Unit tests for StorageFactory
 * Tests factory instantiation for all strategies and error handling.
 */


const StorageFactory = require('../../../src/storage/StorageFactory');
const MemoryStorage = require('../../../src/storage/MemoryStorage');
const SqliteStorage = require('../../../src/storage/SqliteStorage');
const PostgresStorage = require('../../../src/storage/PostgresStorage');

describe('StorageFactory', () => {
  describe('create()', () => {
    it('should create MemoryStorage for "memory" strategy', () => {
      const storage = StorageFactory.create({ strategy: 'memory' });
      expect(storage).toBeInstanceOf(MemoryStorage);
    });

    it('should create SqliteStorage for "sqlite" strategy', () => {
      const storage = StorageFactory.create({ strategy: 'sqlite' });
      expect(storage).toBeInstanceOf(SqliteStorage);
    });

    it('should create PostgresStorage for "postgresql" strategy', () => {
      const storage = StorageFactory.create({ strategy: 'postgresql' });
      expect(storage).toBeInstanceOf(PostgresStorage);
    });

    it('should be case-insensitive', () => {
      const storage = StorageFactory.create({ strategy: 'MEMORY' });
      expect(storage).toBeInstanceOf(MemoryStorage);
    });

    it('should pass config to the strategy', () => {
      const storage = StorageFactory.create({
        strategy: 'memory',
        config: { max_records: 100 }
      });
      expect(storage.config.max_records).toBe(100);
    });

    it('should throw for unknown strategy', () => {
      expect(() => StorageFactory.create({ strategy: 'redis' }))
        .toThrow('Unknown storage strategy: "redis"');
    });

    it('should throw if no strategy is provided', () => {
      expect(() => StorageFactory.create({}))
        .toThrow('must include a "strategy" field');
    });

    it('should throw if config is null', () => {
      expect(() => StorageFactory.create(null))
        .toThrow('must include a "strategy" field');
    });

    it('should throw if config is undefined', () => {
      expect(() => StorageFactory.create(undefined))
        .toThrow('must include a "strategy" field');
    });

    it('should use empty object as default config', () => {
      const storage = StorageFactory.create({ strategy: 'memory' });
      expect(storage.config.max_records).toBe(5000); // default
    });
  });

  describe('STRATEGIES enum', () => {
    it('should expose strategy constants', () => {
      expect(StorageFactory.STRATEGIES.MEMORY).toBe('memory');
      expect(StorageFactory.STRATEGIES.SQLITE).toBe('sqlite');
      expect(StorageFactory.STRATEGIES.POSTGRESQL).toBe('postgresql');
    });
  });
});
