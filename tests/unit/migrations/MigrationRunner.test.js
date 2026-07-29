/**
 * @file Unit tests for MigrationRunner
 * Tests migration file discovery, execution tracking, and rollback.
 * Uses an in-memory SQLite database for fast, isolated tests.
 */


const path = require('path');
const fs = require('fs');
const MigrationRunner = require('../../../src/migrations/MigrationRunner');

// Use a temp directory for test migration files
const TEST_MIGRATIONS_DIR = path.join(__dirname, '..', '..', '..', 'test_migrations_tmp');
const TEST_DB_PATH = path.join(__dirname, '..', '..', '..', 'test_migration_runner.db');

/**
 * Write a test migration file.
 * @param {string} filename
 * @param {string} sql
 */
function writeMigration(filename, sql) {
  fs.writeFileSync(path.join(TEST_MIGRATIONS_DIR, filename), sql);
}

describe('MigrationRunner', () => {
  let db;

  beforeEach(() => {
    // Create temp migrations directory
    if (!fs.existsSync(TEST_MIGRATIONS_DIR)) {
      fs.mkdirSync(TEST_MIGRATIONS_DIR, { recursive: true });
    }

    // Create an in-memory SQLite database
    const Database = require('better-sqlite3');
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    db = new Database(TEST_DB_PATH);
  });

  afterEach(() => {
    if (db) db.close();

    // Clean up
    try {
      if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
      if (fs.existsSync(TEST_MIGRATIONS_DIR)) {
        const files = fs.readdirSync(TEST_MIGRATIONS_DIR);
        files.forEach(f => fs.unlinkSync(path.join(TEST_MIGRATIONS_DIR, f)));
        fs.rmdirSync(TEST_MIGRATIONS_DIR);
      }
    } catch { /* ignore */ }
  });

  describe('migrate()', () => {
    it('should create the tracking table', async () => {
      const runner = new MigrationRunner({
        db,
        type: 'sqlite',
        migrationsDir: TEST_MIGRATIONS_DIR
      });

      await runner.migrate();

      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'"
      ).all();
      expect(tables.length).toBe(1);
    });

    it('should run pending migration files', async () => {
      writeMigration('001_test.sql', 'CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT);');

      const runner = new MigrationRunner({
        db,
        type: 'sqlite',
        migrationsDir: TEST_MIGRATIONS_DIR
      });

      const applied = await runner.migrate();
      expect(applied).toEqual(['001_test.sql']);

      // Verify the table was created
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'"
      ).all();
      expect(tables.length).toBe(1);
    });

    it('should skip already-applied migrations', async () => {
      writeMigration('001_test.sql', 'CREATE TABLE test_table (id INTEGER PRIMARY KEY);');

      const runner = new MigrationRunner({
        db,
        type: 'sqlite',
        migrationsDir: TEST_MIGRATIONS_DIR
      });

      const first = await runner.migrate();
      expect(first.length).toBe(1);

      const second = await runner.migrate();
      expect(second.length).toBe(0);
    });

    it('should run migrations in order', async () => {
      writeMigration('001_first.sql', 'CREATE TABLE first_table (id INTEGER PRIMARY KEY);');
      writeMigration('002_second.sql', 'CREATE TABLE second_table (id INTEGER PRIMARY KEY);');

      const runner = new MigrationRunner({
        db,
        type: 'sqlite',
        migrationsDir: TEST_MIGRATIONS_DIR
      });

      const applied = await runner.migrate();
      expect(applied).toEqual(['001_first.sql', '002_second.sql']);
    });

    it('should throw on invalid SQL', async () => {
      writeMigration('001_bad.sql', 'INVALID SQL STATEMENT HERE;');

      const runner = new MigrationRunner({
        db,
        type: 'sqlite',
        migrationsDir: TEST_MIGRATIONS_DIR
      });

      await expect(runner.migrate()).rejects.toThrow('Migration 001_bad.sql failed');
    });
  });

  describe('status()', () => {
    it('should return status of all migrations', async () => {
      writeMigration('001_test.sql', 'CREATE TABLE test_status (id INTEGER);');
      writeMigration('002_test.sql', 'CREATE TABLE test_status2 (id INTEGER);');

      const runner = new MigrationRunner({
        db,
        type: 'sqlite',
        migrationsDir: TEST_MIGRATIONS_DIR
      });

      await runner.migrate();

      // Add a new migration file
      writeMigration('003_pending.sql', 'CREATE TABLE test_pending (id INTEGER);');

      const status = await runner.status();
      expect(status.length).toBe(3);
      expect(status[0].applied).toBe(true);
      expect(status[1].applied).toBe(true);
      expect(status[2].applied).toBe(false);
    });
  });

  describe('rollback()', () => {
    it('should remove the last migration from tracking', async () => {
      writeMigration('001_test.sql', 'CREATE TABLE IF NOT EXISTS rollback_test (id INTEGER);');

      const runner = new MigrationRunner({
        db,
        type: 'sqlite',
        migrationsDir: TEST_MIGRATIONS_DIR
      });

      await runner.migrate();
      const rolled = await runner.rollback();
      expect(rolled).toBe('001_test.sql');

      // Should be re-runnable
      const applied = await runner.migrate();
      expect(applied.length).toBe(1);
    });

    it('should return null if no migrations to rollback', async () => {
      const runner = new MigrationRunner({
        db,
        type: 'sqlite',
        migrationsDir: TEST_MIGRATIONS_DIR
      });

      await runner.migrate(); // just creates tracking table
      const result = await runner.rollback();
      expect(result).toBeNull();
    });

    it('should execute down-migration file if available', async () => {
      writeMigration('001_test.sql', 'CREATE TABLE down_test (id INTEGER);');
      writeMigration('001_test.down.sql', 'DROP TABLE IF EXISTS down_test;');

      const runner = new MigrationRunner({
        db,
        type: 'sqlite',
        migrationsDir: TEST_MIGRATIONS_DIR
      });

      await runner.migrate();

      // Table should exist
      let tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='down_test'").all();
      expect(tables.length).toBe(1);

      await runner.rollback();

      // Table should be dropped
      tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='down_test'").all();
      expect(tables.length).toBe(0);
    });
  });
});
