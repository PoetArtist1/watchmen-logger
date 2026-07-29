/**
 * @module PostgresStorage
 * @description PostgreSQL storage strategy using the pg library with connection pooling.
 * Best suited for production environments with high throughput.
 */

const StorageStrategy = require('./StorageStrategy');
const { MigrationRunner } = require('../migrations');

/**
 * Default configuration for PostgreSQL storage.
 * @readonly
 */
const DEFAULTS = {
  host: 'localhost',
  port: 5432,
  pool_size: 10,
  timeout_ms: 5000,
  ssl: false,
  auto_migrate: true
};

/**
 * PostgreSQL storage strategy using pg Pool.
 * Supports connection strings and individual parameters.
 * Uses prepared statements and connection pooling.
 *
 * @extends StorageStrategy
 */
class PostgresStorage extends StorageStrategy {
  /**
   * @param {object} [config] - PostgreSQL configuration
   * @param {string} [config.connection_string] - Full connection string
   * @param {string} [config.host='localhost'] - Server host
   * @param {number} [config.port=5432] - Server port
   * @param {string} [config.database] - Database name
   * @param {string} [config.user] - Database user
   * @param {string} [config.password] - User password
   * @param {number} [config.pool_size=10] - Connection pool size
   * @param {number} [config.timeout_ms=5000] - Connection timeout
   * @param {boolean} [config.ssl=false] - Enable SSL
   * @param {boolean} [config.auto_migrate=true] - Run migrations on init
   */
  constructor(config = {}) {
    super();
    this.config = { ...DEFAULTS, ...config };
    this.pool = null;
    this._startTime = Date.now();
  }

  /**
   * Create the connection pool, run migrations if configured.
   * @returns {Promise<void>}
   */
  async initialize() {
    const { Pool } = require('pg');

    const poolConfig = this.config.connection_string
      ? {
          connectionString: this.config.connection_string,
          max: this.config.pool_size,
          connectionTimeoutMillis: this.config.timeout_ms,
          ssl: this.config.ssl ? { rejectUnauthorized: false } : false
        }
      : {
          host: this.config.host,
          port: this.config.port,
          database: this.config.database,
          user: this.config.user,
          password: this.config.password,
          max: this.config.pool_size,
          connectionTimeoutMillis: this.config.timeout_ms,
          ssl: this.config.ssl ? { rejectUnauthorized: false } : false
        };

    this.pool = new Pool(poolConfig);

    // Handle pool errors for automatic reconnection
    this.pool.on('error', (err) => {
      console.error('[watchmen-logger] PostgreSQL pool error:', err.message);
    });

    // Validate connection
    try {
      const client = await this.pool.connect();
      client.release();
      console.log('[watchmen-logger] PostgreSQL connection established.');
    } catch (err) {
      console.error('[watchmen-logger] PostgreSQL connection failed:', err.message);
      throw new Error(`PostgreSQL connection failed: ${err.message}`);
    }

    // Run migrations
    if (this.config.auto_migrate) {
      const runner = new MigrationRunner({
        db: this.pool,
        type: 'postgresql'
      });
      await runner.migrate();
    }
  }

  /**
   * Save a request record using a prepared statement.
   * @param {object} record - Request/response data
   * @returns {Promise<void>}
   */
  async save(record) {
    const sql = `
      INSERT INTO requests (
        request_id, timestamp, method, path, full_url, status_code, latency_ms,
        client_ip, user_agent, request_headers, request_query, request_body,
        response_headers, response_body, response_size_bytes, error_message, stack_trace
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    `;

    const values = [
      record.request_id,
      record.timestamp,
      record.method,
      record.path,
      record.full_url,
      record.status_code,
      record.latency_ms,
      record.client_ip || null,
      record.user_agent || null,
      record.request_headers ? JSON.stringify(record.request_headers) : null,
      record.request_query ? JSON.stringify(record.request_query) : null,
      record.request_body != null ? JSON.stringify(record.request_body) : null,
      record.response_headers ? JSON.stringify(record.response_headers) : null,
      record.response_body != null ? JSON.stringify(record.response_body) : null,
      record.response_size_bytes || null,
      record.error_message || null,
      record.stack_trace || null
    ];

    try {
      await this.pool.query(sql, values);
    } catch (err) {
      console.error('[watchmen-logger] PostgreSQL save error:', err.message);
      throw err;
    }
  }

  /**
   * Save a manual log entry.
   * @param {object} logEntry - Log data
   * @returns {Promise<void>}
   */
  async saveLog(logEntry) {
    const sql = `
      INSERT INTO manual_logs (id, timestamp, level, message, stack_trace, metadata, context)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    const values = [
      logEntry.id,
      logEntry.timestamp,
      logEntry.level,
      logEntry.message,
      logEntry.stack_trace || null,
      logEntry.metadata ? JSON.stringify(logEntry.metadata) : null,
      logEntry.context || null
    ];

    try {
      await this.pool.query(sql, values);
    } catch (err) {
      console.error('[watchmen-logger] PostgreSQL saveLog error:', err.message);
      throw err;
    }
  }

  /**
   * Query records with filters and cursor-based pagination.
   * @param {object} [filters] - Filter criteria
   * @param {object} [pagination] - Pagination options
   * @returns {Promise<{data: object[], pagination: object}>}
   */
  async findAll(filters = {}, pagination = {}) {
    const limit = Math.min(pagination.limit || 50, 200);
    const order = pagination.order === 'asc' ? 'ASC' : 'DESC';

    let conditions = [];
    let params = [];
    let paramIndex = 1;

    if (filters.method) {
      const methods = Array.isArray(filters.method) ? filters.method : [filters.method];
      const placeholders = methods.map(() => `$${paramIndex++}`);
      conditions.push(`method IN (${placeholders.join(', ')})`);
      params.push(...methods.map(m => m.toUpperCase()));
    }

    if (filters.status_code) {
      const codes = Array.isArray(filters.status_code) ? filters.status_code : [filters.status_code];
      const placeholders = codes.map(() => `$${paramIndex++}`);
      conditions.push(`status_code IN (${placeholders.join(', ')})`);
      params.push(...codes.map(Number));
    }

    if (filters.path) {
      conditions.push(`path LIKE $${paramIndex++}`);
      params.push(`%${filters.path}%`);
    }

    if (filters.start_date) {
      conditions.push(`timestamp >= $${paramIndex++}`);
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      conditions.push(`timestamp <= $${paramIndex++}`);
      params.push(filters.end_date);
    }

    if (typeof filters.min_latency === 'number') {
      conditions.push(`latency_ms >= $${paramIndex++}`);
      params.push(filters.min_latency);
    }

    if (typeof filters.max_latency === 'number') {
      conditions.push(`latency_ms <= $${paramIndex++}`);
      params.push(filters.max_latency);
    }

    if (filters.has_error === true) {
      conditions.push('status_code >= 400');
    }

    if (filters.search) {
      conditions.push(`(path LIKE $${paramIndex} OR request_id::text LIKE $${paramIndex})`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereForCount = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Cursor
    if (pagination.cursor) {
      const cursorData = this._decodeCursor(pagination.cursor);
      if (cursorData.ts) {
        const op = order === 'DESC' ? '<' : '>';
        conditions.push(`(timestamp ${op} $${paramIndex} OR (timestamp = $${paramIndex} AND request_id::text ${op} $${paramIndex + 1}))`);
        params.push(cursorData.ts, cursorData.id);
        paramIndex += 2;
      }
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Count total (without cursor)
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM requests ${whereForCount}`,
      params.slice(0, params.length - (pagination.cursor ? 2 : 0))
    );
    const totalCount = parseInt(countResult.rows[0].count, 10);

    // Fetch data
    params.push(limit + 1);
    const dataSql = `SELECT * FROM requests ${whereClause} ORDER BY timestamp ${order}, request_id ${order} LIMIT $${paramIndex}`;

    const result = await this.pool.query(dataSql, params);
    const hasMore = result.rows.length > limit;
    const data = result.rows.slice(0, limit).map(row => this._parseRow(row));

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
   * Find a single request by ID.
   * @param {string} id - The request_id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    const result = await this.pool.query(
      'SELECT * FROM requests WHERE request_id = $1',
      [id]
    );
    return result.rows.length > 0 ? this._parseRow(result.rows[0]) : null;
  }

  /**
   * Calculate aggregated metrics.
   * @returns {Promise<object>}
   */
  async getMetrics() {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000).toISOString();

    // Total
    const totalResult = await this.pool.query('SELECT COUNT(*) as count FROM requests');
    const total = parseInt(totalResult.rows[0].count, 10);

    // Rate per minute
    const rateResult = await this.pool.query(
      'SELECT COUNT(*) as count FROM requests WHERE timestamp >= $1',
      [oneMinuteAgo]
    );
    const ratePerMinute = parseInt(rateResult.rows[0].count, 10);

    // By method
    const methodResult = await this.pool.query(
      'SELECT method, COUNT(*) as count FROM requests GROUP BY method'
    );
    const byMethod = {};
    for (const row of methodResult.rows) byMethod[row.method] = parseInt(row.count, 10);

    // By status
    const byStatus = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
    const statusResult = await this.pool.query(`
      SELECT
        CASE
          WHEN status_code >= 200 AND status_code < 300 THEN '2xx'
          WHEN status_code >= 300 AND status_code < 400 THEN '3xx'
          WHEN status_code >= 400 AND status_code < 500 THEN '4xx'
          WHEN status_code >= 500 THEN '5xx'
        END as status_group,
        COUNT(*) as count
      FROM requests GROUP BY status_group
    `);
    for (const row of statusResult.rows) {
      if (row.status_group && byStatus[row.status_group] !== undefined) {
        byStatus[row.status_group] = parseInt(row.count, 10);
      }
    }

    // Latency stats with percentiles
    const latencyResult = await this.pool.query(`
      SELECT
        ROUND(AVG(latency_ms)) as avg,
        MIN(latency_ms) as min,
        MAX(latency_ms) as max,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms) as p50,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) as p99
      FROM requests
    `);
    const ls = latencyResult.rows[0] || {};

    // Errors by endpoint
    const errorResult = await this.pool.query(
      'SELECT path, COUNT(*) as count FROM requests WHERE status_code >= 400 GROUP BY path ORDER BY count DESC LIMIT 20'
    );
    const errorsByEndpoint = {};
    for (const row of errorResult.rows) errorsByEndpoint[row.path] = parseInt(row.count, 10);

    // Top endpoints
    const topResult = await this.pool.query(
      'SELECT path, COUNT(*) as count FROM requests GROUP BY path ORDER BY count DESC LIMIT 10'
    );
    const topEndpoints = topResult.rows.map(r => ({ path: r.path, count: parseInt(r.count, 10) }));

    // Slowest endpoints
    const slowResult = await this.pool.query(
      'SELECT path, ROUND(AVG(latency_ms)) as avg_latency FROM requests GROUP BY path ORDER BY avg_latency DESC LIMIT 10'
    );
    const slowestEndpoints = slowResult.rows.map(r => ({
      path: r.path,
      avg_latency: parseInt(r.avg_latency, 10)
    }));

    // Recent errors
    const recentResult = await this.pool.query(
      'SELECT request_id, timestamp, method, path, status_code, error_message FROM requests WHERE status_code >= 400 ORDER BY timestamp DESC LIMIT 10'
    );

    return {
      requests: { total, by_method: byMethod, by_status: byStatus, rate_per_minute: ratePerMinute },
      performance: {
        avg: parseInt(ls.avg || 0, 10),
        min: ls.min || 0,
        max: ls.max || 0,
        p50: Math.round(ls.p50 || 0),
        p95: Math.round(ls.p95 || 0),
        p99: Math.round(ls.p99 || 0)
      },
      errors: {
        total_4xx: byStatus['4xx'],
        total_5xx: byStatus['5xx'],
        by_endpoint: errorsByEndpoint
      },
      system: {
        uptime_seconds: Math.floor((Date.now() - this._startTime) / 1000),
        version: require('../../package.json').version,
        storage_strategy: 'postgresql'
      },
      top_endpoints: topEndpoints,
      slowest_endpoints: slowestEndpoints,
      recent_errors: recentResult.rows
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
    let params = [];
    let paramIndex = 1;

    if (filters.level) {
      conditions.push(`level = $${paramIndex++}`);
      params.push(filters.level);
    }
    if (filters.start_date) {
      conditions.push(`timestamp >= $${paramIndex++}`);
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      conditions.push(`timestamp <= $${paramIndex++}`);
      params.push(filters.end_date);
    }
    if (filters.search) {
      conditions.push(`message LIKE $${paramIndex++}`);
      params.push(`%${filters.search}%`);
    }

    if (pagination.cursor) {
      const cursorData = this._decodeCursor(pagination.cursor);
      if (cursorData.ts) {
        const op = order === 'DESC' ? '<' : '>';
        conditions.push(`(timestamp ${op} $${paramIndex} OR (timestamp = $${paramIndex} AND id::text ${op} $${paramIndex + 1}))`);
        params.push(cursorData.ts, cursorData.id);
        paramIndex += 2;
      }
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM manual_logs ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count, 10);

    params.push(limit + 1);
    const dataSql = `SELECT * FROM manual_logs ${whereClause} ORDER BY timestamp ${order} LIMIT $${paramIndex}`;

    const result = await this.pool.query(dataSql, params);
    const hasMore = result.rows.length > limit;
    const data = result.rows.slice(0, limit);

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
   * Remove old records.
   * @param {object} [options] - Cleanup options
   * @returns {Promise<number>}
   */
  async cleanup(options = {}) {
    const olderThanDays = options.older_than_days || 7;
    const cutoff = new Date(Date.now() - (olderThanDays * 86400000)).toISOString();

    const result = await this.pool.query(
      'DELETE FROM requests WHERE timestamp < $1',
      [cutoff]
    );
    const logResult = await this.pool.query(
      'DELETE FROM manual_logs WHERE timestamp < $1',
      [cutoff]
    );

    return (result.rowCount || 0) + (logResult.rowCount || 0);
  }

  /**
   * Close the connection pool.
   * @returns {Promise<void>}
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('[watchmen-logger] PostgreSQL pool closed.');
    }
  }

  // ─── Private ──────────────────────────────────────────────────────

  /**
   * Parse JSONB fields from a database row.
   * @private
   */
  _parseRow(row) {
    // pg auto-parses JSONB to objects, but just in case:
    return {
      ...row,
      request_headers: typeof row.request_headers === 'string'
        ? JSON.parse(row.request_headers) : row.request_headers,
      request_query: typeof row.request_query === 'string'
        ? JSON.parse(row.request_query) : row.request_query,
      request_body: typeof row.request_body === 'string'
        ? JSON.parse(row.request_body) : row.request_body,
      response_headers: typeof row.response_headers === 'string'
        ? JSON.parse(row.response_headers) : row.response_headers,
      response_body: typeof row.response_body === 'string'
        ? JSON.parse(row.response_body) : row.response_body
    };
  }

  /** @private */
  _encodeCursor(record) {
    const id = record.request_id || record.id;
    const ts = record.timestamp instanceof Date ? record.timestamp.toISOString() : record.timestamp;
    return Buffer.from(JSON.stringify({ id, ts })).toString('base64');
  }

  /** @private */
  _decodeCursor(cursor) {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
    } catch {
      return { id: null, ts: null };
    }
  }
}

module.exports = PostgresStorage;
