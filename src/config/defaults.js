/**
 * @module config/defaults
 * @description Default values for logger.config.json sections (RF-06).
 */

/** @type {Readonly<object>} */
const DEFAULT_CONFIG = Object.freeze({
  storage: {
    strategy: 'memory',
    config: {
      max_records: 5000,
      cleanup_enabled: true,
      cleanup_interval_minutes: 10,
      cleanup_older_than_hours: 24
    }
  },
  capture: {
    request_headers: true,
    request_body: true,
    request_query: true,
    response_headers: true,
    response_body: false,
    max_body_size_kb: 100,
    excluded_paths: [],
    excluded_methods: [],
    sensitive_headers: ['authorization', 'cookie', 'set-cookie'],
    mask_sensitive_data: true
  },
  retention: {
    enabled: false,
    max_records: 10000,
    cleanup_interval_minutes: 30,
    cleanup_older_than_days: 7,
    archive_before_delete: false,
    archive_path: null
  },
  monitoring: {
    endpoint: '/api/monitoring',
    enabled: true,
    cache_metrics: true,
    cache_duration_seconds: 30,
    page_size: 50,
    max_page_size: 200,
    auto_refresh_interval: 30,
    auth: {
      enabled: false,
      type: 'basic',
      username: null,
      password: null,
      session_timeout_hours: 1
    }
  },
  performance: {
    async_logging: true,
    batch_size: 50,
    batch_interval_ms: 1000,
    max_queue_size: 1000
  }
});

/** Defaults for memory storage config */
const MEMORY_STORAGE_DEFAULTS = Object.freeze({
  max_records: 5000,
  cleanup_enabled: true,
  cleanup_interval_minutes: 10,
  cleanup_older_than_hours: 24
});

/** Defaults for SQLite storage config */
const SQLITE_STORAGE_DEFAULTS = Object.freeze({
  database_path: './logs/api_logs.db',
  auto_vacuum: true,
  journal_mode: 'WAL'
});

/** Defaults for PostgreSQL storage config */
const POSTGRES_STORAGE_DEFAULTS = Object.freeze({
  host: 'localhost',
  port: 5432,
  pool_size: 10,
  timeout_ms: 5000,
  ssl: false,
  auto_migrate: true
});

module.exports = {
  DEFAULT_CONFIG,
  MEMORY_STORAGE_DEFAULTS,
  SQLITE_STORAGE_DEFAULTS,
  POSTGRES_STORAGE_DEFAULTS
};
