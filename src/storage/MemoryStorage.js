/**
 * @module MemoryStorage
 * @description In-memory storage strategy using a circular buffer.
 * Data is volatile — lost when the process restarts.
 * Best suited for development and testing environments.
 */

const StorageStrategy = require('./StorageStrategy');

/**
 * Default configuration for memory storage.
 * @readonly
 */
const DEFAULTS = {
  max_records: 5000,
  cleanup_enabled: true,
  cleanup_interval_minutes: 10,
  cleanup_older_than_hours: 24
};

/**
 * In-memory storage strategy with circular buffer behavior.
 * When `max_records` is reached, the oldest record is evicted (FIFO).
 *
 * @extends StorageStrategy
 */
class MemoryStorage extends StorageStrategy {
  /**
   * @param {object} [config] - Memory storage configuration
   * @param {number} [config.max_records=5000] - Maximum records to keep
   * @param {boolean} [config.cleanup_enabled=true] - Enable periodic cleanup
   * @param {number} [config.cleanup_interval_minutes=10] - Cleanup interval
   * @param {number} [config.cleanup_older_than_hours=24] - Max age for records
   */
  constructor(config = {}) {
    super();
    this.config = { ...DEFAULTS, ...config };

    /** @type {object[]} Circular buffer of request records */
    this._records = [];

    /** @type {object[]} Manual log entries */
    this._logs = [];

    /** @type {NodeJS.Timeout|null} Cleanup timer reference */
    this._cleanupTimer = null;

    /** @type {number} Process start time for uptime calculation */
    this._startTime = Date.now();
  }

  /**
   * Initialize memory storage and start cleanup timer if enabled.
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.config.cleanup_enabled) {
      this._startCleanupTimer();
    }
  }

  /**
   * Save a request record. Evicts oldest record if at capacity (FIFO).
   * @param {object} record - Request/response record
   * @returns {Promise<void>}
   */
  async save(record) {
    if (!record || !record.request_id) {
      throw new Error('Record must include a request_id');
    }

    // FIFO: remove oldest when at capacity
    if (this._records.length >= this.config.max_records) {
      this._records.shift();
    }

    this._records.push({
      ...record,
      created_at: record.created_at || new Date().toISOString()
    });
  }

  /**
   * Save a manual log entry.
   * @param {object} logEntry - Log entry with id, timestamp, level, message
   * @returns {Promise<void>}
   */
  async saveLog(logEntry) {
    if (!logEntry || !logEntry.id) {
      throw new Error('Log entry must include an id');
    }

    if (this._logs.length >= this.config.max_records) {
      this._logs.shift();
    }

    this._logs.push({
      ...logEntry,
      created_at: logEntry.created_at || new Date().toISOString()
    });
  }

  /**
   * Query records with filters and cursor-based pagination.
   * @param {object} [filters] - Filter criteria
   * @param {object} [pagination] - Pagination options
   * @returns {Promise<{data: object[], pagination: object}>}
   */
  async findAll(filters = {}, pagination = {}) {
    const limit = Math.min(pagination.limit || 50, 200);
    const order = pagination.order || 'desc';

    let filtered = this._applyFilters(this._records, filters);
    const totalCount = filtered.length;

    // Sort by timestamp
    filtered.sort((a, b) => {
      const cmp = new Date(a.timestamp) - new Date(b.timestamp);
      return order === 'desc' ? -cmp : cmp;
    });

    // Apply cursor-based pagination
    let startIndex = 0;
    if (pagination.cursor) {
      const cursorData = this._decodeCursor(pagination.cursor);
      startIndex = filtered.findIndex(r =>
        r.request_id === cursorData.id
      );
      if (startIndex === -1) {
        startIndex = 0;
      } else {
        startIndex += 1; // Start after the cursor record
      }
    }

    const page = filtered.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < filtered.length;

    return {
      data: page,
      pagination: {
        has_more: hasMore,
        next_cursor: hasMore ? this._encodeCursor(page[page.length - 1]) : null,
        prev_cursor: startIndex > 0 ? this._encodeCursor(filtered[startIndex - 1]) : null,
        total_count: totalCount
      }
    };
  }

  /**
   * Find a single record by request_id.
   * @param {string} id - The request_id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    return this._records.find(r => r.request_id === id) || null;
  }

  /**
   * Calculate aggregated metrics from in-memory records.
   * @returns {Promise<object>} Complete metrics object
   */
  async getMetrics() {
    const records = this._records;
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;

    // Basic counts
    const total = records.length;
    const recentRecords = records.filter(r => new Date(r.timestamp).getTime() > oneMinuteAgo);
    const ratePerMinute = recentRecords.length;

    // By method
    const byMethod = {};
    for (const r of records) {
      byMethod[r.method] = (byMethod[r.method] || 0) + 1;
    }

    // By status group
    const byStatus = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
    for (const r of records) {
      const group = `${Math.floor(r.status_code / 100)}xx`;
      if (byStatus[group] !== undefined) {
        byStatus[group]++;
      }
    }

    // Latency stats
    const latencies = records.map(r => r.latency_ms).filter(l => typeof l === 'number');
    latencies.sort((a, b) => a - b);
    const latencyStats = this._calculateLatencyStats(latencies);

    // Error distribution by endpoint
    const errorsByEndpoint = {};
    for (const r of records) {
      if (r.status_code >= 400) {
        errorsByEndpoint[r.path] = (errorsByEndpoint[r.path] || 0) + 1;
      }
    }

    // Top 10 endpoints
    const endpointCounts = {};
    for (const r of records) {
      endpointCounts[r.path] = (endpointCounts[r.path] || 0) + 1;
    }
    const topEndpoints = Object.entries(endpointCounts)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top 10 slowest endpoints (by avg latency)
    const endpointLatencies = {};
    for (const r of records) {
      if (!endpointLatencies[r.path]) {
        endpointLatencies[r.path] = { total: 0, count: 0 };
      }
      endpointLatencies[r.path].total += r.latency_ms || 0;
      endpointLatencies[r.path].count++;
    }
    const slowestEndpoints = Object.entries(endpointLatencies)
      .map(([path, data]) => ({ path, avg_latency: Math.round(data.total / data.count) }))
      .sort((a, b) => b.avg_latency - a.avg_latency)
      .slice(0, 10);

    // Recent errors
    const recentErrors = records
      .filter(r => r.status_code >= 400)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10)
      .map(r => ({
        request_id: r.request_id,
        timestamp: r.timestamp,
        method: r.method,
        path: r.path,
        status_code: r.status_code,
        error_message: r.error_message
      }));

    // Timeline: requests per minute for the last hour
    const timeline = this._buildTimeline(records, oneHourAgo, now);

    return {
      requests: {
        total,
        by_method: byMethod,
        by_status: byStatus,
        rate_per_minute: ratePerMinute
      },
      performance: latencyStats,
      errors: {
        total_4xx: byStatus['4xx'],
        total_5xx: byStatus['5xx'],
        by_endpoint: errorsByEndpoint
      },
      system: {
        uptime_seconds: Math.floor((now - this._startTime) / 1000),
        version: require('../../package.json').version,
        storage_strategy: 'memory',
        records_in_memory: total
      },
      top_endpoints: topEndpoints,
      slowest_endpoints: slowestEndpoints,
      recent_errors: recentErrors,
      timeline
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
    const order = pagination.order || 'desc';

    let filtered = [...this._logs];

    if (filters.level) {
      const levels = Array.isArray(filters.level) ? filters.level : [filters.level];
      filtered = filtered.filter(l => levels.includes(l.level));
    }
    if (filters.start_date) {
      const start = new Date(filters.start_date).getTime();
      filtered = filtered.filter(l => new Date(l.timestamp).getTime() >= start);
    }
    if (filters.end_date) {
      const end = new Date(filters.end_date).getTime();
      filtered = filtered.filter(l => new Date(l.timestamp).getTime() <= end);
    }
    if (filters.search) {
      const term = filters.search.toLowerCase();
      filtered = filtered.filter(l => l.message.toLowerCase().includes(term));
    }

    const totalCount = filtered.length;
    filtered.sort((a, b) => {
      const cmp = new Date(a.timestamp) - new Date(b.timestamp);
      return order === 'desc' ? -cmp : cmp;
    });

    let startIndex = 0;
    if (pagination.cursor) {
      const cursorData = this._decodeCursor(pagination.cursor);
      startIndex = filtered.findIndex(l => l.id === cursorData.id);
      if (startIndex === -1) startIndex = 0;
      else startIndex += 1;
    }

    const page = filtered.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < filtered.length;

    return {
      data: page,
      pagination: {
        has_more: hasMore,
        next_cursor: hasMore && page.length > 0 ? this._encodeCursor(page[page.length - 1]) : null,
        prev_cursor: startIndex > 0 ? this._encodeCursor(filtered[startIndex - 1]) : null,
        total_count: totalCount
      }
    };
  }

  /**
   * Remove records older than the configured threshold.
   * @param {object} [options] - Override cleanup options
   * @returns {Promise<number>} Number of records removed
   */
  async cleanup(options = {}) {
    const olderThanHours = options.older_than_hours || this.config.cleanup_older_than_hours;
    const maxRecords = options.max_records || this.config.max_records;

    const cutoff = Date.now() - (olderThanHours * 3600000);
    const beforeCount = this._records.length;

    this._records = this._records.filter(r =>
      new Date(r.timestamp).getTime() >= cutoff
    );

    // Also enforce max_records
    if (this._records.length > maxRecords) {
      this._records = this._records.slice(this._records.length - maxRecords);
    }

    const removedRequests = beforeCount - this._records.length;

    // Clean logs too
    const beforeLogs = this._logs.length;
    this._logs = this._logs.filter(l =>
      new Date(l.timestamp).getTime() >= cutoff
    );
    const removedLogs = beforeLogs - this._logs.length;

    return removedRequests + removedLogs;
  }

  /**
   * Stop cleanup timer and free memory.
   * @returns {Promise<void>}
   */
  async close() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
    this._records = [];
    this._logs = [];
  }

  // ─── Private helpers ────────────────────────────────────────────────

  /**
   * Start the periodic cleanup timer.
   * @private
   */
  _startCleanupTimer() {
    const intervalMs = this.config.cleanup_interval_minutes * 60 * 1000;
    this._cleanupTimer = setInterval(() => {
      this.cleanup().catch(err => {
        console.error('[watchmen-logger] Memory cleanup error:', err.message);
      });
    }, intervalMs);

    // Don't prevent process exit
    if (this._cleanupTimer.unref) {
      this._cleanupTimer.unref();
    }
  }

  /**
   * Apply filter criteria to a set of records.
   * @private
   * @param {object[]} records - Records to filter
   * @param {object} filters - Filter criteria
   * @returns {object[]} Filtered records
   */
  _applyFilters(records, filters) {
    let result = [...records];

    if (filters.method) {
      const methods = Array.isArray(filters.method) ? filters.method : [filters.method];
      const upper = methods.map(m => m.toUpperCase());
      result = result.filter(r => upper.includes(r.method));
    }

    if (filters.status_code) {
      const codes = Array.isArray(filters.status_code)
        ? filters.status_code
        : [filters.status_code];
      result = result.filter((r) =>
        codes.some((code) => _matchesStatusCode(r.status_code, code))
      );
    }

    if (filters.path) {
      const pathLower = filters.path.toLowerCase();
      result = result.filter(r => r.path.toLowerCase().includes(pathLower));
    }

    if (filters.start_date) {
      const start = new Date(filters.start_date).getTime();
      result = result.filter(r => new Date(r.timestamp).getTime() >= start);
    }

    if (filters.end_date) {
      const end = new Date(filters.end_date).getTime();
      result = result.filter(r => new Date(r.timestamp).getTime() <= end);
    }

    if (typeof filters.min_latency === 'number') {
      result = result.filter(r => r.latency_ms >= filters.min_latency);
    }

    if (typeof filters.max_latency === 'number') {
      result = result.filter(r => r.latency_ms <= filters.max_latency);
    }

    if (filters.has_error === true) {
      result = result.filter(r => r.status_code >= 400);
    }

    if (filters.search) {
      const term = filters.search.toLowerCase();
      result = result.filter(r =>
        r.path.toLowerCase().includes(term) ||
        r.request_id.toLowerCase().includes(term)
      );
    }

    return result;
  }

  /**
   * Calculate latency percentile statistics.
   * @private
   * @param {number[]} sortedLatencies - Sorted array of latency values
   * @returns {object} Latency stats: avg, min, max, p50, p95, p99
   */
  _calculateLatencyStats(sortedLatencies) {
    if (sortedLatencies.length === 0) {
      return { avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sum = sortedLatencies.reduce((a, b) => a + b, 0);
    const len = sortedLatencies.length;

    return {
      avg: Math.round(sum / len),
      min: sortedLatencies[0],
      max: sortedLatencies[len - 1],
      p50: sortedLatencies[Math.floor(len * 0.5)],
      p95: sortedLatencies[Math.floor(len * 0.95)],
      p99: sortedLatencies[Math.floor(len * 0.99)]
    };
  }

  /**
   * Build a timeline of requests per minute for charting.
   * @private
   * @param {object[]} records - All records
   * @param {number} fromTime - Start timestamp in ms
   * @param {number} toTime - End timestamp in ms
   * @returns {Array<{timestamp: string, count: number}>}
   */
  _buildTimeline(records, fromTime, toTime) {
    const buckets = {};
    const intervalMs = 60000; // 1 minute

    // Initialize buckets
    for (let t = fromTime; t <= toTime; t += intervalMs) {
      const key = new Date(t).toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
      buckets[key] = 0;
    }

    // Fill buckets
    for (const r of records) {
      const ts = new Date(r.timestamp).getTime();
      if (ts >= fromTime && ts <= toTime) {
        const key = new Date(ts).toISOString().slice(0, 16);
        if (buckets[key] !== undefined) {
          buckets[key]++;
        }
      }
    }

    return Object.entries(buckets).map(([timestamp, count]) => ({ timestamp, count }));
  }

  /**
   * Encode a record into a cursor string for pagination.
   * @private
   * @param {object} record - Record to create cursor from
   * @returns {string} Base64-encoded cursor
   */
  _encodeCursor(record) {
    const id = record.request_id || record.id;
    const ts = record.timestamp;
    return Buffer.from(JSON.stringify({ id, ts })).toString('base64');
  }

  /**
   * Decode a cursor string back into its component data.
   * @private
   * @param {string} cursor - Base64-encoded cursor
   * @returns {{id: string, ts: string}} Decoded cursor data
   */
  _decodeCursor(cursor) {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
    } catch {
      return { id: null, ts: null };
    }
  }
}

/**
 * Match an HTTP status against a concrete code or a group like "4xx".
 * @param {number} actual
 * @param {string|number} filter
 * @returns {boolean}
 */
function _matchesStatusCode(actual, filter) {
  const token = String(filter).trim().toLowerCase();
  if (/^[2-5]xx$/.test(token)) {
    const base = Number(token[0]) * 100;
    return actual >= base && actual < base + 100;
  }
  return actual === Number(token);
}

module.exports = MemoryStorage;
