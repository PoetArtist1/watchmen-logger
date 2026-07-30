/**
 * @module Logger
 * @description Public WatchmenLogger instance: config bootstrap + manual logging API (RF-05).
 */

const { loadConfig } = require('./config');
const { StorageFactory } = require('./storage');
const { createCaptureMiddleware } = require('./middleware');
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
   * @returns {Function} Express middleware
   */
  middleware() {
    this._assertOpen();
    return createCaptureMiddleware(this.storage, this.config.capture);
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
   * @deprecated Since v0.1.0. Use logInfo / logWarning / logError / logDebug instead.
   *   Will be removed in v1.0.0. See MIGRATION.md.
   * @param {string} level
   * @param {string} message
   * @param {object} [metadata]
   * @returns {Promise<object>}
   */
  async log(level, message, metadata) {
    if (!WatchmenLogger._logWarned) {
      WatchmenLogger._logWarned = true;
      console.warn(
        '[watchmen-logger] DEPRECATION WARNING: log(level, message) is deprecated and will be removed in v1.0.0. '
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
