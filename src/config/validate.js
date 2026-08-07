/**
 * @module config/validate
 * @description Validate logger.config.json shape, types, enums and dependent fields (RF-06).
 */

const {
  MEMORY_STORAGE_DEFAULTS,
  SQLITE_STORAGE_DEFAULTS,
  POSTGRES_STORAGE_DEFAULTS
} = require('./defaults');

const VALID_STRATEGIES = new Set(['memory', 'sqlite', 'postgresql']);
const VALID_JOURNAL_MODES = new Set(['DELETE', 'WAL', 'MEMORY']);
const VALID_AUTH_TYPES = new Set(['basic']);

/**
 * Deep-merge defaults under a plain object (arrays are replaced, not merged).
 * @param {object} defaults
 * @param {object} overrides
 * @returns {object}
 */
function deepMerge(defaults, overrides) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return structuredClone(defaults);
  }

  const result = structuredClone(defaults);
  for (const [key, value] of Object.entries(overrides)) {
    if (
      value
      && typeof value === 'object'
      && !Array.isArray(value)
      && result[key]
      && typeof result[key] === 'object'
      && !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], value);
    } else if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * @param {string} path
 * @param {*} value
 * @param {string} expected
 * @returns {string}
 */
function typeError(path, value, expected) {
  const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  return `"${path}" must be ${expected}, got ${actual}`;
}

/**
 * Validate and normalize a fully env-resolved configuration object.
 * Applies defaults for optional fields and returns a ready-to-use config.
 *
 * @param {object} raw - Parsed + env-resolved config
 * @returns {object} Validated configuration with defaults applied
 * @throws {Error} Aggregate validation errors with clear messages
 */
function validateConfig(raw) {
  const errors = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('[watchmen-logger] Configuration must be a JSON object');
  }

  if (!raw.storage || typeof raw.storage !== 'object') {
    errors.push('"storage" section is required and must be an object');
  }
  if (!raw.capture || typeof raw.capture !== 'object') {
    errors.push('"capture" section is required and must be an object');
  }
  if (!raw.monitoring || typeof raw.monitoring !== 'object') {
    errors.push('"monitoring" section is required and must be an object');
  }

  if (errors.length > 0) {
    throw new Error(`[watchmen-logger] Invalid configuration:\n  - ${errors.join('\n  - ')}`);
  }

  const storage = { ...raw.storage };
  const capture = { ...raw.capture };
  const monitoring = { ...raw.monitoring };
  const retention = raw.retention && typeof raw.retention === 'object' ? { ...raw.retention } : {};
  const performance = raw.performance && typeof raw.performance === 'object' ? { ...raw.performance } : {};

  // --- storage ---
  if (typeof storage.strategy !== 'string' || !VALID_STRATEGIES.has(storage.strategy)) {
    errors.push(
      `"storage.strategy" must be one of: ${[...VALID_STRATEGIES].join(', ')}`
    );
  }

  if (storage.config !== undefined && (typeof storage.config !== 'object' || Array.isArray(storage.config))) {
    errors.push('"storage.config" must be an object');
  }

  const strategy = storage.strategy;
  let storageConfig = storage.config && typeof storage.config === 'object' ? { ...storage.config } : {};

  if (strategy === 'memory') {
    storageConfig = deepMerge(MEMORY_STORAGE_DEFAULTS, storageConfig);
    _assertInteger(errors, 'storage.config.max_records', storageConfig.max_records, 1);
    _assertBoolean(errors, 'storage.config.cleanup_enabled', storageConfig.cleanup_enabled);
    _assertInteger(errors, 'storage.config.cleanup_interval_minutes', storageConfig.cleanup_interval_minutes, 1);
    _assertInteger(errors, 'storage.config.cleanup_older_than_hours', storageConfig.cleanup_older_than_hours, 1);
  } else if (strategy === 'sqlite') {
    storageConfig = deepMerge(SQLITE_STORAGE_DEFAULTS, storageConfig);
    _assertString(errors, 'storage.config.database_path', storageConfig.database_path);
    _assertBoolean(errors, 'storage.config.auto_vacuum', storageConfig.auto_vacuum);
    if (typeof storageConfig.journal_mode !== 'string'
      || !VALID_JOURNAL_MODES.has(storageConfig.journal_mode.toUpperCase())) {
      errors.push(`"storage.config.journal_mode" must be one of: ${[...VALID_JOURNAL_MODES].join(', ')}`);
    } else {
      storageConfig.journal_mode = storageConfig.journal_mode.toUpperCase();
    }
  } else if (strategy === 'postgresql') {
    storageConfig = deepMerge(POSTGRES_STORAGE_DEFAULTS, storageConfig);
    const hasConnectionString = typeof storageConfig.connection_string === 'string'
      && storageConfig.connection_string.length > 0;
    const hasIndividual = typeof storageConfig.host === 'string'
      && typeof storageConfig.database === 'string'
      && typeof storageConfig.user === 'string';

    if (!hasConnectionString && !hasIndividual) {
      errors.push(
        '"storage.config" for postgresql requires either "connection_string" '
        + 'or "host", "database" and "user"'
      );
    }

    if (hasConnectionString) {
      if (!/^postgres(ql)?:\/\//i.test(storageConfig.connection_string)) {
        errors.push('"storage.config.connection_string" must start with postgresql:// or postgres://');
      }
    } else {
      _assertString(errors, 'storage.config.host', storageConfig.host);
      _assertString(errors, 'storage.config.database', storageConfig.database);
      _assertString(errors, 'storage.config.user', storageConfig.user);
      if (storageConfig.password !== undefined) {
        _assertString(errors, 'storage.config.password', storageConfig.password);
      }
      _assertInteger(errors, 'storage.config.port', storageConfig.port, 1, 65535);
    }

    _assertInteger(errors, 'storage.config.pool_size', storageConfig.pool_size, 1);
    if (storageConfig.timeout_ms !== undefined) {
      _assertInteger(errors, 'storage.config.timeout_ms', storageConfig.timeout_ms, 1);
    }
    if (storageConfig.ssl !== undefined) {
      _assertBoolean(errors, 'storage.config.ssl', storageConfig.ssl);
    }
    if (storageConfig.auto_migrate !== undefined) {
      _assertBoolean(errors, 'storage.config.auto_migrate', storageConfig.auto_migrate);
    }
  }

  // --- capture ---
  _assertBoolean(errors, 'capture.request_headers', capture.request_headers);
  _assertBoolean(errors, 'capture.request_body', capture.request_body);
  _assertBoolean(errors, 'capture.request_query', capture.request_query);
  _assertBoolean(errors, 'capture.response_headers', capture.response_headers);
  _assertBoolean(errors, 'capture.response_body', capture.response_body);
  _assertInteger(errors, 'capture.max_body_size_kb', capture.max_body_size_kb, 1);
  _assertStringArray(errors, 'capture.excluded_paths', capture.excluded_paths);
  _assertStringArray(errors, 'capture.excluded_methods', capture.excluded_methods);
  _assertStringArray(errors, 'capture.sensitive_headers', capture.sensitive_headers);
  _assertBoolean(errors, 'capture.mask_sensitive_data', capture.mask_sensitive_data);

  // --- monitoring ---
  _assertString(errors, 'monitoring.endpoint', monitoring.endpoint);
  if (typeof monitoring.endpoint === 'string' && !monitoring.endpoint.startsWith('/')) {
    errors.push('"monitoring.endpoint" must start with "/"');
  }
  _assertBoolean(errors, 'monitoring.enabled', monitoring.enabled);
  _assertBoolean(errors, 'monitoring.cache_metrics', monitoring.cache_metrics);
  _assertInteger(errors, 'monitoring.cache_duration_seconds', monitoring.cache_duration_seconds, 1);
  _assertInteger(errors, 'monitoring.page_size', monitoring.page_size, 1);
  _assertInteger(errors, 'monitoring.max_page_size', monitoring.max_page_size, 1);
  _assertInteger(errors, 'monitoring.auto_refresh_interval', monitoring.auto_refresh_interval, 5, 300);

  if (monitoring.page_size != null && monitoring.max_page_size != null
    && Number.isInteger(monitoring.page_size) && Number.isInteger(monitoring.max_page_size)
    && monitoring.page_size > monitoring.max_page_size) {
    errors.push('"monitoring.page_size" cannot be greater than "monitoring.max_page_size"');
  }

  const auth = monitoring.auth && typeof monitoring.auth === 'object' ? { ...monitoring.auth } : { enabled: false };
  _assertBoolean(errors, 'monitoring.auth.enabled', auth.enabled);
  if (auth.enabled) {
    if (auth.type !== undefined && !VALID_AUTH_TYPES.has(auth.type)) {
      errors.push(`"monitoring.auth.type" must be one of: ${[...VALID_AUTH_TYPES].join(', ')}`);
    }
    if (typeof auth.username !== 'string' || auth.username.length === 0) {
      errors.push('"monitoring.auth.username" is required when auth is enabled');
    }
    if (typeof auth.password !== 'string' || auth.password.length === 0) {
      errors.push('"monitoring.auth.password" is required when auth is enabled');
    }
    if (auth.session_timeout_hours !== undefined) {
      _assertInteger(errors, 'monitoring.auth.session_timeout_hours', auth.session_timeout_hours, 1);
    }
  }
  monitoring.auth = auth;

  // --- retention (optional) ---
  if (Object.keys(retention).length > 0) {
    if (retention.enabled !== undefined) _assertBoolean(errors, 'retention.enabled', retention.enabled);
    if (retention.max_records !== undefined) _assertInteger(errors, 'retention.max_records', retention.max_records, 1);
    if (retention.cleanup_interval_minutes !== undefined) {
      _assertInteger(errors, 'retention.cleanup_interval_minutes', retention.cleanup_interval_minutes, 1);
    }
    if (retention.cleanup_older_than_days !== undefined) {
      _assertInteger(errors, 'retention.cleanup_older_than_days', retention.cleanup_older_than_days, 1);
    }
    if (retention.archive_before_delete !== undefined) {
      _assertBoolean(errors, 'retention.archive_before_delete', retention.archive_before_delete);
    }
    if (retention.archive_before_delete === true
      && (typeof retention.archive_path !== 'string' || retention.archive_path.length === 0)) {
      errors.push('"retention.archive_path" is required when archive_before_delete is true');
    }
  }

  // --- performance (optional) ---
  if (Object.keys(performance).length > 0) {
    if (performance.async_logging !== undefined) {
      _assertBoolean(errors, 'performance.async_logging', performance.async_logging);
    }
    if (performance.batch_size !== undefined) {
      _assertInteger(errors, 'performance.batch_size', performance.batch_size, 1);
    }
    if (performance.batch_interval_ms !== undefined) {
      _assertInteger(errors, 'performance.batch_interval_ms', performance.batch_interval_ms, 1);
    }
    if (performance.max_queue_size !== undefined) {
      _assertInteger(errors, 'performance.max_queue_size', performance.max_queue_size, 1);
    }
  }

  if (errors.length > 0) {
    throw new Error(`[watchmen-logger] Invalid configuration:\n  - ${errors.join('\n  - ')}`);
  }

  return {
    storage: { strategy, config: storageConfig },
    capture,
    monitoring,
    retention,
    performance
  };
}

function _assertBoolean(errors, path, value) {
  if (typeof value !== 'boolean') {
    errors.push(typeError(path, value, 'a boolean'));
  }
}

function _assertString(errors, path, value) {
  if (typeof value !== 'string' || value.length === 0) {
    errors.push(typeError(path, value, 'a non-empty string'));
  }
}

function _assertInteger(errors, path, value, min, max) {
  if (!Number.isInteger(value)) {
    errors.push(typeError(path, value, 'an integer'));
    return;
  }
  if (min !== undefined && value < min) {
    errors.push(`"${path}" must be >= ${min}, got ${value}`);
  }
  if (max !== undefined && value > max) {
    errors.push(`"${path}" must be <= ${max}, got ${value}`);
  }
}

function _assertStringArray(errors, path, value) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    errors.push(typeError(path, value, 'an array of strings'));
  }
}

module.exports = {
  validateConfig,
  deepMerge,
  VALID_STRATEGIES
};
