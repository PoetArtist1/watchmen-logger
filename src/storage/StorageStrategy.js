/**
 * @module StorageStrategy
 * @description Abstract base class that defines the interface all storage strategies
 * must implement. Uses the Strategy Pattern so consumers can swap between Memory,
 * SQLite, and PostgreSQL without changing calling code.
 */

/**
 * Abstract storage strategy.
 * Every concrete strategy (MemoryStorage, SqliteStorage, PostgresStorage)
 * must extend this class and implement all methods.
 *
 * @abstract
 */
class StorageStrategy {
  /**
   * Initialize the storage backend (create tables, open connections, etc.).
   * Must be called before any other method.
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('StorageStrategy.initialize() must be implemented by subclass');
  }

  /**
   * Persist a captured request/response record.
   * @param {object} record - The captured request data
   * @param {string} record.request_id - UUID v4 identifier
   * @param {string} record.timestamp - ISO 8601 datetime
   * @param {string} record.method - HTTP method (GET, POST, etc.)
   * @param {string} record.path - Endpoint path
   * @param {string} record.full_url - Full request URL
   * @param {number} record.status_code - HTTP status code
   * @param {number} record.latency_ms - Response time in milliseconds
   * @param {string} [record.client_ip] - Client IP address
   * @param {string} [record.user_agent] - Client user agent
   * @param {object} [record.request_headers] - Request headers
   * @param {object} [record.request_query] - Query parameters
   * @param {*} [record.request_body] - Request body
   * @param {object} [record.response_headers] - Response headers
   * @param {*} [record.response_body] - Response body
   * @param {number} [record.response_size_bytes] - Response size in bytes
   * @param {string} [record.error_message] - Error message (if status >= 400)
   * @param {string} [record.stack_trace] - Stack trace (for 5xx errors)
   * @returns {Promise<void>}
   */
  async save(record) {
    throw new Error('StorageStrategy.save() must be implemented by subclass');
  }

  /**
   * Persist a captured request/response record.
   * @deprecated Since v0.1.0. Use {@link StorageStrategy#save} instead.
   *   `store()` will be removed in the next MAJOR release (v1.0.0).
   *   See MIGRATION.md for details.
   * @param {object} record - The captured request data
   * @returns {Promise<void>}
   */
  async store(record) {
    if (!StorageStrategy._storeWarned) {
      StorageStrategy._storeWarned = true;
      console.warn(
        '[watchmen-logger] DEPRECATION WARNING: store() is deprecated and will be removed in v1.0.0. ' +
        'Use save() instead. See MIGRATION.md for migration guide.'
      );
    }
    return this.save(record);
  }

  /**
   * Save a manual log entry (from logInfo, logWarning, logError, logDebug).
   * @param {object} logEntry - The manual log entry
   * @param {string} logEntry.id - Unique log ID
   * @param {string} logEntry.timestamp - ISO 8601 datetime
   * @param {string} logEntry.level - Severity level (INFO, WARNING, ERROR, DEBUG)
   * @param {string} logEntry.message - Log message
   * @param {string} [logEntry.stack_trace] - Stack trace for errors
   * @param {object} [logEntry.metadata] - Additional metadata
   * @param {string} [logEntry.context] - Execution context info
   * @returns {Promise<void>}
   */
  async saveLog(logEntry) {
    throw new Error('StorageStrategy.saveLog() must be implemented by subclass');
  }

  /**
   * Find all records matching filters with cursor-based pagination.
   * @param {object} [filters] - Filter criteria
   * @param {string|string[]} [filters.method] - HTTP method(s) to filter
   * @param {number|number[]} [filters.status_code] - Status code(s) to filter
   * @param {string} [filters.path] - Partial path match
   * @param {string} [filters.start_date] - ISO 8601 start date
   * @param {string} [filters.end_date] - ISO 8601 end date
   * @param {number} [filters.min_latency] - Minimum latency in ms
   * @param {number} [filters.max_latency] - Maximum latency in ms
   * @param {boolean} [filters.has_error] - Only records with errors
   * @param {object} [pagination] - Pagination options
   * @param {string} [pagination.cursor] - Cursor for continuation
   * @param {number} [pagination.limit=50] - Records per page (max 200)
   * @param {string} [pagination.order='desc'] - Sort order ('asc' or 'desc')
   * @returns {Promise<{data: object[], pagination: {has_more: boolean, next_cursor: string|null, prev_cursor: string|null, total_count: number}}>}
   */
  async findAll(filters, pagination) {
    throw new Error('StorageStrategy.findAll() must be implemented by subclass');
  }

  /**
   * Find a single request record by its ID.
   * @param {string} id - The request_id (UUID)
   * @returns {Promise<object|null>} The record or null if not found
   */
  async findById(id) {
    throw new Error('StorageStrategy.findById() must be implemented by subclass');
  }

  /**
   * Calculate and return aggregated metrics.
   * @returns {Promise<object>} Metrics object with:
   *   - requests: { total, by_method, by_status, rate_per_minute }
   *   - performance: { avg, min, max, p50, p95, p99 }
   *   - errors: { total_4xx, total_5xx, by_endpoint }
   *   - system: { uptime, version }
   *   - top_endpoints: Array of { path, count }
   *   - slowest_endpoints: Array of { path, avg_latency }
   */
  async getMetrics() {
    throw new Error('StorageStrategy.getMetrics() must be implemented by subclass');
  }

  /**
   * Find all manual log entries with cursor-based pagination.
   * @param {object} [filters] - Filter criteria
   * @param {string} [filters.level] - Log level filter
   * @param {string} [filters.start_date] - ISO 8601 start date
   * @param {string} [filters.end_date] - ISO 8601 end date
   * @param {string} [filters.search] - Text search in message
   * @param {object} [pagination] - Pagination options
   * @returns {Promise<{data: object[], pagination: object}>}
   */
  async findLogs(filters, pagination) {
    throw new Error('StorageStrategy.findLogs() must be implemented by subclass');
  }

  /**
   * Remove old records based on retention policy.
   * @param {object} [options] - Cleanup options
   * @param {number} [options.older_than_hours] - Remove records older than N hours
   * @param {number} [options.max_records] - Keep only the most recent N records
   * @returns {Promise<number>} Number of records removed
   */
  async cleanup(options) {
    throw new Error('StorageStrategy.cleanup() must be implemented by subclass');
  }

  /**
   * Close connections and free resources.
   * @returns {Promise<void>}
   */
  async close() {
    throw new Error('StorageStrategy.close() must be implemented by subclass');
  }
}

module.exports = StorageStrategy;
