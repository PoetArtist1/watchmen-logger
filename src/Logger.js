/**
 * @module Logger
 * @description Public WatchmenLogger instance: config bootstrap + manual logging API (RF-05).
 */

const { loadConfig } = require('./config');
const { StorageFactory } = require('./storage');
const { createCaptureMiddleware } = require('./middleware');
const { createMonitoringRouter } = require('./monitoring');
const { generateUuid, nowISO8601, maskSensitiveData } = require('./utils');

const LOG_LEVELS = Object.freeze({
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  DEBUG: 'DEBUG'
});

/**
 * Extract caller context (file, line, function) from the stack, skipping
 * frames that belong to this logger module.
 * @returns {string|null}
 */
function captureCallerContext() {
  const stack = new Error().stack;
  if (!stack) {
    return null;
  }

  const lines = stack.split('\n').slice(2);
  for (const line of lines) {
    if (line.includes(`${require('path').sep}Logger.js`) || line.includes('/Logger.js')) {
      continue;
    }
    const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/);
    if (match) {
      const fn = match[1] || '<anonymous>';
      const file = match[2];
      const lineNo = match[3];
      return `${fn} (${file}:${lineNo})`;
    }
  }
  return null;
}

/**
 * High-level logger that wires configuration, storage and the public logging API.
 */
class WatchmenLogger {
  /**
   * @param {object} options
   * @param {object} options.config - Validated configuration
   * @param {import('./storage/StorageStrategy')} options.storage - Initialized storage
   */
  constructor({ config, storage }) {
    this.config = config;
    this.storage = storage;
    this._closed = false;
  }

  /**
   * Create Express capture middleware bound to this logger's storage and capture config.
   * Automatically excludes the monitoring endpoint prefix so the UI does not log itself.
   * @returns {Function} Express middleware
   */
  middleware() {
    this._assertOpen();
    const capture = { ...(this.config.capture || {}) };
    const monitorPath = (this.config.monitoring?.endpoint || '/api/monitoring').replace(/\/+$/, '');
    const excluded = new Set([
      ...(capture.excluded_paths || []),
      monitorPath,
      `${monitorPath}/`,
      `${monitorPath}*` // prefix match for SPA + API under the mount
    ]);
    capture.excluded_paths = [...excluded];
    return createCaptureMiddleware(this.storage, capture);
  }

  /**
   * Create Express router for the monitoring SPA + JSON APIs (RF-03).
   * Mount with: `app.use(logger.config.monitoring.endpoint, logger.monitoring())`
   * or simply `app.use(logger.monitoring())` when using the default endpoint via mount helper.
   * @returns {import('express').Router|Function}
   */
  monitoring() {
    this._assertOpen();
    const monitoring = this.config.monitoring || {};
    if (monitoring.enabled === false) {
      const disabled = (req, res) => {
        res.status(404).json({ error: 'Monitoring UI is disabled' });
      };
      disabled.mountPath = monitoring.endpoint || '/api/monitoring';
      return disabled;
    }
    const router = createMonitoringRouter(this.storage, monitoring);
    router.mountPath = monitoring.endpoint || '/api/monitoring';
    return router;
  }

  /**
   * Convenience: mount capture + monitoring on an Express app.
   * @param {import('express').Application} app
   * @returns {WatchmenLogger}
   */
  attach(app) {
    this._assertOpen();
    if (!app || typeof app.use !== 'function') {
      throw new TypeError('[watchmen-logger] attach() expects an Express app');
    }
    app.use(this.middleware());
    const monitoring = this.config.monitoring || {};
    if (monitoring.enabled !== false) {
      const endpoint = monitoring.endpoint || '/api/monitoring';
      app.use(endpoint, this.monitoring());
    }
    return this;
  }

  /**
   * Register an INFO-level manual log.
   * @param {string} message
   * @param {object} [metadata]
   * @returns {Promise<object>} Persisted log entry
   */
  async logInfo(message, metadata) {
    return this._writeLog(LOG_LEVELS.INFO, message, null, metadata);
  }

  /**
   * Register a WARNING-level manual log.
   * @param {string} message
   * @param {object} [metadata]
   * @returns {Promise<object>} Persisted log entry
   */
  async logWarning(message, metadata) {
    return this._writeLog(LOG_LEVELS.WARNING, message, null, metadata);
  }

  /**
   * Register an ERROR-level manual log.
   * @param {string} message
   * @param {Error|*} [error] - Optional Error (or value) for stack trace
   * @param {object} [metadata]
   * @returns {Promise<object>} Persisted log entry
   */
  async logError(message, error, metadata) {
    // Support logError(message, metadata) when the second arg is a plain object
    if (
      error
      && typeof error === 'object'
      && !(error instanceof Error)
      && metadata === undefined
      && !('stack' in error)
    ) {
      return this._writeLog(LOG_LEVELS.ERROR, message, null, error);
    }
    return this._writeLog(LOG_LEVELS.ERROR, message, error, metadata);
  }

  /**
   * Register a DEBUG-level manual log.
   * @param {string} message
   * @param {object} [metadata]
   * @returns {Promise<object>} Persisted log entry
   */
  async logDebug(message, metadata) {
    return this._writeLog(LOG_LEVELS.DEBUG, message, null, metadata);
  }

  /**
   * @deprecated Since v1.0.0. Use logInfo / logWarning / logError / logDebug instead.
   *   Will be removed in v2.0.0. See MIGRATION.md.
   * @param {string} level
   * @param {string} message
   * @param {object} [metadata]
   * @returns {Promise<object>}
   */
  async log(level, message, metadata) {
    if (!WatchmenLogger._logWarned) {
      WatchmenLogger._logWarned = true;
      console.warn(
        '[watchmen-logger] DEPRECATION WARNING: log(level, message) is deprecated and will be removed in v2.0.0. '
        + 'Use logInfo / logWarning / logError / logDebug instead. See MIGRATION.md.'
      );
    }

    const normalized = String(level || '').toUpperCase();
    switch (normalized) {
      case 'INFO':
        return this.logInfo(message, metadata);
      case 'WARNING':
      case 'WARN':
        return this.logWarning(message, metadata);
      case 'ERROR':
        return this.logError(message, null, metadata);
      case 'DEBUG':
        return this.logDebug(message, metadata);
      default:
        return this.logInfo(message, { ...metadata, original_level: level });
    }
  }

  /**
   * Close the underlying storage backend.
   * @returns {Promise<void>}
   */
  async close() {
    if (this._closed) {
      return;
    }
    this._closed = true;
    await this.storage.close();
  }

  /**
   * @private
   */
  _assertOpen() {
    if (this._closed) {
      throw new Error('[watchmen-logger] Logger has been closed');
    }
  }

  /**
   * @private
   * @param {string} level
   * @param {string} message
   * @param {Error|*} [error]
   * @param {object} [metadata]
   * @returns {Promise<object>}
   */
  async _writeLog(level, message, error, metadata) {
    this._assertOpen();

    if (typeof message !== 'string' || message.length === 0) {
      throw new TypeError('[watchmen-logger] Log message must be a non-empty string');
    }

    let stackTrace = null;
    if (error instanceof Error) {
      stackTrace = error.stack || error.message;
    } else if (typeof error === 'string' && error.length > 0) {
      stackTrace = error;
    }

    const shouldMask = this.config.capture?.mask_sensitive_data !== false;
    const safeMetadata = metadata != null && typeof metadata === 'object'
      ? (shouldMask ? maskSensitiveData(metadata) : { ...metadata })
      : null;

    const entry = {
      id: generateUuid(),
      timestamp: nowISO8601(),
      level,
      message,
      stack_trace: stackTrace,
      metadata: safeMetadata,
      context: captureCallerContext()
    };

    try {
      await this.storage.saveLog(entry);
    } catch (err) {
      // Isolate logger failures from the host application (RNF-02)
      console.error('[watchmen-logger] Failed to persist manual log:', err.message);
    }

    return entry;
  }
}

/**
 * Create and initialize a WatchmenLogger from `logger.config.json` / `.env`.
 *
 * @param {object} [options] - Options forwarded to {@link loadConfig}, plus:
 * @param {import('./storage/StorageStrategy')} [options.storage] - Inject a pre-built storage (tests)
 * @returns {Promise<WatchmenLogger>}
 *
 * @example
 * const logger = await createLogger();
 * app.use(logger.middleware());
 * await logger.logInfo('Server started');
 */
async function createLogger(options = {}) {
  const { storage: injectedStorage, ...configOptions } = options;
  const config = loadConfig(configOptions);

  const storage = injectedStorage || StorageFactory.create(config.storage);
  if (!injectedStorage) {
    await storage.initialize();
  }

  return new WatchmenLogger({ config, storage });
}

module.exports = {
  WatchmenLogger,
  createLogger,
  LOG_LEVELS
};
