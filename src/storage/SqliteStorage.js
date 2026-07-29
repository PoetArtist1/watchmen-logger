/**
 * @module SqliteStorage
 * @description SQLite storage strategy using better-sqlite3.
 * Persists data in a local .db file with no external database server required.
 * Best suited for small-to-medium applications.
 */

const StorageStrategy = require('./StorageStrategy');
const path = require('path');
const fs = require('fs');

/**
 * Default configuration for SQLite storage.
 * @readonly
 */
const DEFAULTS = {
  database_path: './logs/api_logs.db',
  auto_vacuum: true,
  journal_mode: 'WAL'
};

/**
 * SQLite-based storage strategy using better-sqlite3 (synchronous, embedded).
 * Creates tables and indices automatically on initialization.
 *
 * @extends StorageStrategy
 */
class SqliteStorage extends StorageStrategy {
  /**
   * @param {object} [config] - SQLite storage configuration
   * @param {string} [config.database_path='./logs/api_logs.db'] - Path to .db file
   * @param {boolean} [config.auto_vacuum=true] - Enable auto vacuum
   * @param {string} [config.journal_mode='WAL'] - SQLite journal mode
   */
  constructor(config = {}) {
    super();
    this.config = { ...DEFAULTS, ...config };
    this.db = null;
    this._startTime = Date.now();
    this._statements = {};
  }

  /**
   * Open the database, create tables and indices, configure pragmas.
   * @returns {Promise<void>}
   */
  async initialize() {
    // Ensure directory exists
    const dir = path.dirname(this.config.database_path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // better-sqlite3 is synchronous
    const Database = require('better-sqlite3');
    this.db = new Database(this.config.database_path);

    // Configure pragmas
    this.db.pragma(`journal_mode = ${this.config.journal_mode}`);
    if (this.config.auto_vacuum) {
      this.db.pragma('auto_vacuum = INCREMENTAL');
    }
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');

    // Create tables
    this._createTables();
    this._createIndices();
    this._prepareStatements();
  }

  /**
   * Save a request record to the database.
   * @param {object} record - Request/response data
   * @returns {Promise<void>}
   */
  async save(record) {
    try {
      this._statements.insertRequest.run({
        request_id: record.request_id,
        timestamp: record.timestamp,
        method: record.method,
        path: record.path,
        full_url: record.full_url,
        status_code: record.status_code,
        latency_ms: record.latency_ms,
        client_ip: record.client_ip || null,
        user_agent: record.user_agent || null,
        request_headers: record.request_headers ? JSON.stringify(record.request_headers) : null,
        request_query: record.request_query ? JSON.stringify(record.request_query) : null,
        request_body: record.request_body != null ? JSON.stringify(record.request_body) : null,
        response_headers: record.response_headers ? JSON.stringify(record.response_headers) : null,
        response_body: record.response_body != null ? JSON.stringify(record.response_body) : null,
        response_size_bytes: record.response_size_bytes || null,
        error_message: record.error_message || null,
        stack_trace: record.stack_trace || null
      });
    } catch (err) {
      console.error('[watchmen-logger] SQLite save error:', err.message);
      throw err;
    }
  }

  /**
   * Save a manual log entry.
   * @param {object} logEntry - Log entry data
   * @returns {Promise<void>}
   */
  async saveLog(logEntry) {
    try {
      this._statements.insertLog.run({
        id: logEntry.id,
        timestamp: logEntry.timestamp,
        level: logEntry.level,
        message: logEntry.message,
        stack_trace: logEntry.stack_trace || null,
        metadata: logEntry.metadata ? JSON.stringify(logEntry.metadata) : null,
        context: logEntry.context || null
      });
    } catch (err) {
      console.error('[watchmen-logger] SQLite saveLog error:', err.message);
      throw err;
    }
  }

  /**
   * Query request records with filters and cursor-based pagination.
   * @param {object} [filters] - Filter criteria
   * @param {object} [pagination] - Pagination options
   * @returns {Promise<{data: object[], pagination: object}>}
   */
  async findAll(filters = {}, pagination = {}) {
    const limit = Math.min(pagination.limit || 50, 200);
    const order = pagination.order === 'asc' ? 'ASC' : 'DESC';

    let conditions = [];
    let params = {};

    // Build WHERE clause from filters
    if (filters.method) {
      const methods = Array.isArray(filters.method) ? filters.method : [filters.method];
      const placeholders = methods.map((m, i) => `@method_${i}`);
      conditions.push(`method IN (${placeholders.join(', ')})`);
      methods.forEach((m, i) => { params[`method_${i}`] = m.toUpperCase(); });
    }

    if (filters.status_code) {
      const codes = Array.isArray(filters.status_code) ? filters.status_code : [filters.status_code];
      const placeholders = codes.map((_, i) => `@status_${i}`);
      conditions.push(`status_code IN (${placeholders.join(', ')})`);
      codes.forEach((c, i) => { params[`status_${i}`] = Number(c); });
    }

    if (filters.path) {
      conditions.push('path LIKE @path_filter');
      params.path_filter = `%${filters.path}%`;
    }

    if (filters.start_date) {
      conditions.push('timestamp >= @start_date');
      params.start_date = filters.start_date;
    }

    if (filters.end_date) {
      conditions.push('timestamp <= @end_date');
      params.end_date = filters.end_date;
    }

    if (typeof filters.min_latency === 'number') {
      conditions.push('latency_ms >= @min_latency');
      params.min_latency = filters.min_latency;
    }

    if (typeof filters.max_latency === 'number') {
      conditions.push('latency_ms <= @max_latency');
      params.max_latency = filters.max_latency;
    }

    if (filters.has_error === true) {
      conditions.push('status_code >= 400');
    }

    if (filters.search) {
      conditions.push('(path LIKE @search OR request_id LIKE @search)');
      params.search = `%${filters.search}%`;
    }

    const whereClause = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    // Cursor pagination
    if (pagination.cursor) {
      const cursorData = this._decodeCursor(pagination.cursor);
      if (cursorData.ts) {
        const cursorOp = order === 'DESC' ? '<' : '>';
        const cursorCondition = `(timestamp ${cursorOp} @cursor_ts OR (timestamp = @cursor_ts AND request_id ${cursorOp} @cursor_id))`;
        conditions.push(cursorCondition);
        params.cursor_ts = cursorData.ts;
        params.cursor_id = cursorData.id;
      }
    }

    const whereClauseFinal = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    // Count total (without cursor, with filters)
    const countSql = `SELECT COUNT(*) as count FROM requests ${whereClause}`;
    const totalCount = this.db.prepare(countSql).get(params)?.count || 0;

    // Fetch data
    const dataSql = `SELECT * FROM requests ${whereClauseFinal} ORDER BY timestamp ${order}, request_id ${order} LIMIT @limit`;
    params.limit = limit + 1; // Fetch one extra to determine has_more

    const rows = this.db.prepare(dataSql).all(params);
    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit).map(row => this._deserializeRow(row));

    return {
      data,
      pagination: {
        has_more: hasMore,
        next_cursor: hasMore && data.length > 0 ? this._encodeCursor(data[data.length - 1]) : null,
        prev_cursor: pagination.cursor ? pagination.cursor : null,
        total_count: totalCount
      }
    };
  }

  /**
   * Find a single request by ID.
   * @param {string} id - The request_id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    const row = this._statements.findById.get({ request_id: id });
    return row ? this._deserializeRow(row) : null;
  }

  /**
   * Calculate aggregated metrics using SQL queries.
   * @returns {Promise<object>}
   */
  async getMetrics() {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000).toISOString();
    const oneHourAgo = new Date(now.getTime() - 3600000).toISOString();

    // Total
    const total = this.db.prepare('SELECT COUNT(*) as count FROM requests').get().count;

    // Rate per minute
    const ratePerMinute = this.db.prepare(
      'SELECT COUNT(*) as count FROM requests WHERE timestamp >= @since'
    ).get({ since: oneMinuteAgo }).count;

    // By method
    const byMethodRows = this.db.prepare(
      'SELECT method, COUNT(*) as count FROM requests GROUP BY method'
    ).all();
    const byMethod = {};
    for (const row of byMethodRows) byMethod[row.method] = row.count;

    // By status group
    const byStatus = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
    const statusRows = this.db.prepare(
      `SELECT
        CASE
          WHEN status_code >= 200 AND status_code < 300 THEN '2xx'
          WHEN status_code >= 300 AND status_code < 400 THEN '3xx'
          WHEN status_code >= 400 AND status_code < 500 THEN '4xx'
          WHEN status_code >= 500 THEN '5xx'
        END as status_group,
        COUNT(*) as count
      FROM requests GROUP BY status_group`
    ).all();
    for (const row of statusRows) {
      if (row.status_group && byStatus[row.status_group] !== undefined) {
        byStatus[row.status_group] = row.count;
      }
    }

    // Latency stats
    const latencyRow = this.db.prepare(
      'SELECT AVG(latency_ms) as avg, MIN(latency_ms) as min, MAX(latency_ms) as max FROM requests'
    ).get();

    // Percentiles
    const p50 = this._getPercentile(50);
    const p95 = this._getPercentile(95);
    const p99 = this._getPercentile(99);

    // Error distribution by endpoint
    const errorsByEndpoint = {};
    const errorRows = this.db.prepare(
      'SELECT path, COUNT(*) as count FROM requests WHERE status_code >= 400 GROUP BY path ORDER BY count DESC LIMIT 20'
    ).all();
    for (const row of errorRows) errorsByEndpoint[row.path] = row.count;

    // Top 10 endpoints
    const topEndpoints = this.db.prepare(
      'SELECT path, COUNT(*) as count FROM requests GROUP BY path ORDER BY count DESC LIMIT 10'
    ).all();

    // Top 10 slowest endpoints
    const slowestEndpoints = this.db.prepare(
      'SELECT path, ROUND(AVG(latency_ms)) as avg_latency FROM requests GROUP BY path ORDER BY avg_latency DESC LIMIT 10'
    ).all();

    // Recent errors
    const recentErrors = this.db.prepare(
      'SELECT request_id, timestamp, method, path, status_code, error_message FROM requests WHERE status_code >= 400 ORDER BY timestamp DESC LIMIT 10'
    ).all();

    return {
      requests: {
        total,
        by_method: byMethod,
        by_status: byStatus,
        rate_per_minute: ratePerMinute
      },
      performance: {
        avg: Math.round(latencyRow?.avg || 0),
        min: latencyRow?.min || 0,
        max: latencyRow?.max || 0,
        p50, p95, p99
      },
      errors: {
        total_4xx: byStatus['4xx'],
        total_5xx: byStatus['5xx'],
        by_endpoint: errorsByEndpoint
      },
      system: {
        uptime_seconds: Math.floor((Date.now() - this._startTime) / 1000),
        version: require('../../package.json').version,
        storage_strategy: 'sqlite',
        database_path: this.config.database_path
      },
      top_endpoints: topEndpoints,
      slowest_endpoints: slowestEndpoints,
      recent_errors: recentErrors
    };
  }

  /**
   * Query manual logs with filters and pagination.
   * @param {object} [filters] - Filter criteria
   * @param {object} [pagination] - Pagination options
   * @returns {Promise<{data: object[], pagination: object}>}
   */
  async findLogs(filters = {}, pagination = {}) {
    const limit = Math.min(pagination.limit || 50, 200);
    const order = pagination.order === 'asc' ? 'ASC' : 'DESC';

    let conditions = [];
    let params = {};

    if (filters.level) {
      conditions.push('level = @level');
      params.level = filters.level;
    }
    if (filters.start_date) {
      conditions.push('timestamp >= @start_date');
      params.start_date = filters.start_date;
    }
    if (filters.end_date) {
      conditions.push('timestamp <= @end_date');
      params.end_date = filters.end_date;
    }
    if (filters.search) {
      conditions.push('message LIKE @search');
      params.search = `%${filters.search}%`;
    }

    if (pagination.cursor) {
      const cursorData = this._decodeCursor(pagination.cursor);
      if (cursorData.ts) {
        const op = order === 'DESC' ? '<' : '>';
        conditions.push(`(timestamp ${op} @cursor_ts OR (timestamp = @cursor_ts AND id ${op} @cursor_id))`);
        params.cursor_ts = cursorData.ts;
        params.cursor_id = cursorData.id;
      }
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countSql = `SELECT COUNT(*) as count FROM manual_logs ${whereClause}`;
    const totalCount = this.db.prepare(countSql).get(params)?.count || 0;

    params.limit = limit + 1;
    const dataSql = `SELECT * FROM manual_logs ${whereClause} ORDER BY timestamp ${order} LIMIT @limit`;
    const rows = this.db.prepare(dataSql).all(params);

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit).map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    }));

    return {
      data,
      pagination: {
        has_more: hasMore,
        next_cursor: hasMore && data.length > 0 ? this._encodeCursor(data[data.length - 1]) : null,
        prev_cursor: pagination.cursor || null,
        total_count: totalCount
      }
    };
  }

  /**
   * Remove old records based on retention options.
   * @param {object} [options] - Cleanup options
   * @returns {Promise<number>} Number of records removed
   */
  async cleanup(options = {}) {
    const olderThanDays = options.older_than_days || 7;
    const cutoff = new Date(Date.now() - (olderThanDays * 86400000)).toISOString();

    const result = this.db.prepare(
      'DELETE FROM requests WHERE timestamp < @cutoff'
    ).run({ cutoff });

    const logResult = this.db.prepare(
      'DELETE FROM manual_logs WHERE timestamp < @cutoff'
    ).run({ cutoff });

    // Run incremental vacuum if configured
    if (this.config.auto_vacuum) {
      try {
        this.db.pragma('incremental_vacuum');
      } catch { /* ignore vacuum errors */ }
    }

    return (result.changes || 0) + (logResult.changes || 0);
  }

  /**
   * Close the database connection.
   * @returns {Promise<void>}
   */
  async close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────

  /**
   * Create the requests and manual_logs tables.
   * @private
   */
  _createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS requests (
        request_id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        method VARCHAR(10) NOT NULL,
        path TEXT NOT NULL,
        full_url TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        latency_ms INTEGER NOT NULL,
        client_ip VARCHAR(45),
        user_agent TEXT,
        request_headers TEXT,
        request_query TEXT,
        request_body TEXT,
        response_headers TEXT,
        response_body TEXT,
        response_size_bytes INTEGER,
        error_message TEXT,
        stack_trace TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS manual_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        level VARCHAR(10) NOT NULL,
        message TEXT NOT NULL,
        stack_trace TEXT,
        metadata TEXT,
        context TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
  }

  /**
   * Create required indices for efficient queries.
   * @private
   */
  _createIndices() {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_requests_path ON requests(path);
      CREATE INDEX IF NOT EXISTS idx_requests_status_code ON requests(status_code);
      CREATE INDEX IF NOT EXISTS idx_requests_method ON requests(method);
      CREATE INDEX IF NOT EXISTS idx_requests_latency ON requests(latency_ms);
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON manual_logs(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_logs_level ON manual_logs(level);
    `);
  }

  /**
   * Prepare reusable SQL statements.
   * @private
   */
  _prepareStatements() {
    this._statements.insertRequest = this.db.prepare(`
      INSERT INTO requests (
        request_id, timestamp, method, path, full_url, status_code, latency_ms,
        client_ip, user_agent, request_headers, request_query, request_body,
        response_headers, response_body, response_size_bytes, error_message, stack_trace
      ) VALUES (
        @request_id, @timestamp, @method, @path, @full_url, @status_code, @latency_ms,
        @client_ip, @user_agent, @request_headers, @request_query, @request_body,
        @response_headers, @response_body, @response_size_bytes, @error_message, @stack_trace
      )
    `);

    this._statements.insertLog = this.db.prepare(`
      INSERT INTO manual_logs (id, timestamp, level, message, stack_trace, metadata, context)
      VALUES (@id, @timestamp, @level, @message, @stack_trace, @metadata, @context)
    `);

    this._statements.findById = this.db.prepare(
      'SELECT * FROM requests WHERE request_id = @request_id'
    );
  }

  /**
   * Calculate a latency percentile using SQL.
   * @private
   * @param {number} percentile - The percentile value (e.g. 50, 95, 99)
   * @returns {number}
   */
  _getPercentile(percentile) {
    const row = this.db.prepare(`
      SELECT latency_ms FROM requests
      ORDER BY latency_ms
      LIMIT 1 OFFSET (SELECT CAST(COUNT(*) * @p / 100.0 AS INTEGER) FROM requests)
    `).get({ p: percentile });
    return row?.latency_ms || 0;
  }

  /**
   * Deserialize JSON fields from a database row.
   * @private
   * @param {object} row - Raw database row
   * @returns {object} Row with parsed JSON fields
   */
  _deserializeRow(row) {
    return {
      ...row,
      request_headers: row.request_headers ? JSON.parse(row.request_headers) : null,
      request_query: row.request_query ? JSON.parse(row.request_query) : null,
      request_body: row.request_body ? JSON.parse(row.request_body) : null,
      response_headers: row.response_headers ? JSON.parse(row.response_headers) : null,
      response_body: row.response_body ? JSON.parse(row.response_body) : null
    };
  }

  /**
   * Encode a record into a cursor string.
   * @private
   */
  _encodeCursor(record) {
    const id = record.request_id || record.id;
    const ts = record.timestamp;
    return Buffer.from(JSON.stringify({ id, ts })).toString('base64');
  }

  /**
   * Decode a cursor string.
   * @private
   */
  _decodeCursor(cursor) {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
    } catch {
      return { id: null, ts: null };
    }
  }
}

module.exports = SqliteStorage;
