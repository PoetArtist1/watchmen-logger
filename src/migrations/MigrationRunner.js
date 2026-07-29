/**
 * @module MigrationRunner
 * @description Reads numbered .sql migration files, tracks applied migrations
 * in a `_migrations` table, and executes pending ones in order.
 * Supports both PostgreSQL (via pg Pool) and SQLite (via better-sqlite3).
 */

const fs = require('fs');
const path = require('path');

/**
 * Runs SQL migration scripts against a database.
 * Maintains a `_migrations` table to track which migrations have been applied.
 */
class MigrationRunner {
  /**
   * @param {object} options
   * @param {object} options.db - Database connection (pg Pool or better-sqlite3 instance)
   * @param {string} [options.migrationsDir] - Directory containing .sql files
   * @param {string} [options.type='sqlite'] - Database type: 'sqlite' or 'postgresql'
   */
  constructor(options) {
    this.db = options.db;
    this.type = options.type || 'sqlite';
    this.migrationsDir = options.migrationsDir || path.join(__dirname);
  }

  /**
   * Run all pending migrations in order.
   * Creates the tracking table if it doesn't exist.
   * @returns {Promise<string[]>} List of applied migration filenames
   */
  async migrate() {
    await this._ensureTrackingTable();
    const applied = await this._getAppliedMigrations();
    const files = this._getMigrationFiles();

    const pending = files.filter(f => !applied.includes(f));
    const results = [];

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(this.migrationsDir, file), 'utf8');
      try {
        await this._executeSql(sql);
        await this._markApplied(file);
        results.push(file);
        console.log(`[watchmen-logger] Migration applied: ${file}`);
      } catch (err) {
        console.error(`[watchmen-logger] Migration failed: ${file}`, err.message);
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }

    if (results.length === 0) {
      console.log('[watchmen-logger] No pending migrations.');
    }

    return results;
  }

  /**
   * Rollback the last applied migration (removes it from tracking).
   * Note: Does not reverse SQL changes — for that, use numbered down-scripts.
   * @returns {Promise<string|null>} The rolled-back migration filename
   */
  async rollback() {
    const applied = await this._getAppliedMigrations();
    if (applied.length === 0) return null;

    const last = applied[applied.length - 1];

    // Check for a corresponding down-migration file
    const downFile = last.replace('.sql', '.down.sql');
    const downPath = path.join(this.migrationsDir, downFile);
    if (fs.existsSync(downPath)) {
      const sql = fs.readFileSync(downPath, 'utf8');
      await this._executeSql(sql);
    }

    await this._removeApplied(last);
    console.log(`[watchmen-logger] Rolled back: ${last}`);
    return last;
  }

  /**
   * Get the status of all migrations.
   * @returns {Promise<Array<{file: string, applied: boolean}>>}
   */
  async status() {
    const applied = await this._getAppliedMigrations();
    const files = this._getMigrationFiles();

    return files.map(file => ({
      file,
      applied: applied.includes(file)
    }));
  }

  // ─── Private ──────────────────────────────────────────────────────

  /**
   * List .sql migration files sorted by number prefix.
   * @private
   * @returns {string[]}
   */
  _getMigrationFiles() {
    if (!fs.existsSync(this.migrationsDir)) return [];

    return fs.readdirSync(this.migrationsDir)
      .filter(f => f.endsWith('.sql') && !f.endsWith('.down.sql'))
      .sort();
  }

  /**
   * Create the _migrations tracking table if it doesn't exist.
   * @private
   */
  async _ensureTrackingTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY ${this.type === 'postgresql' ? 'GENERATED ALWAYS AS IDENTITY' : 'AUTOINCREMENT'},
        filename TEXT NOT NULL UNIQUE,
        applied_at ${this.type === 'postgresql' ? 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()' : "TEXT DEFAULT (datetime('now'))"}
      )
    `;
    await this._executeSql(sql);
  }

  /**
   * Get list of already-applied migration filenames.
   * @private
   * @returns {Promise<string[]>}
   */
  async _getAppliedMigrations() {
    try {
      if (this.type === 'postgresql') {
        const result = await this.db.query(
          'SELECT filename FROM _migrations ORDER BY id'
        );
        return result.rows.map(r => r.filename);
      } else {
        const rows = this.db.prepare(
          'SELECT filename FROM _migrations ORDER BY id'
        ).all();
        return rows.map(r => r.filename);
      }
    } catch {
      return [];
    }
  }

  /**
   * Mark a migration as applied.
   * @private
   * @param {string} filename
   */
  async _markApplied(filename) {
    if (this.type === 'postgresql') {
      await this.db.query(
        'INSERT INTO _migrations (filename) VALUES ($1)',
        [filename]
      );
    } else {
      this.db.prepare(
        'INSERT INTO _migrations (filename) VALUES (?)'
      ).run(filename);
    }
  }

  /**
   * Remove a migration from tracking (for rollback).
   * @private
   * @param {string} filename
   */
  async _removeApplied(filename) {
    if (this.type === 'postgresql') {
      await this.db.query(
        'DELETE FROM _migrations WHERE filename = $1',
        [filename]
      );
    } else {
      this.db.prepare(
        'DELETE FROM _migrations WHERE filename = ?'
      ).run(filename);
    }
  }

  /**
   * Execute raw SQL against the database.
   * @private
   * @param {string} sql
   */
  async _executeSql(sql) {
    if (this.type === 'postgresql') {
      await this.db.query(sql);
    } else {
      this.db.exec(sql);
    }
  }
}

module.exports = MigrationRunner;
