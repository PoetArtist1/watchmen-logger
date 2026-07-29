/**
 * @module captureMiddleware
 * @description Express middleware that automatically intercepts every HTTP request
 * and response, extracts the data specified in RF-02, and persists it via the
 * configured storage strategy — all without blocking the event loop.
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Default capture configuration.
 * @readonly
 */
const CAPTURE_DEFAULTS = {
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
};

/**
 * Creates Express middleware that captures request/response data.
 *
 * The middleware hooks into `res.end` to capture the response after it is sent,
 * then persists the data asynchronously to avoid blocking the event loop.
 * Overhead target: < 5ms per request.
 *
 * @param {import('../storage/StorageStrategy')} storage - Initialized storage instance
 * @param {object} [captureConfig] - Capture configuration (from logger.config.json)
 * @returns {Function} Express middleware function
 *
 * @example
 * const storage = StorageFactory.create(config.storage);
 * await storage.initialize();
 * app.use(createCaptureMiddleware(storage, config.capture));
 */
function createCaptureMiddleware(storage, captureConfig = {}) {
  const config = { ...CAPTURE_DEFAULTS, ...captureConfig };

  // Pre-compute excluded paths and methods for fast lookup
  const excludedPaths = new Set(config.excluded_paths.map(p => p.toLowerCase()));
  const excludedMethods = new Set(config.excluded_methods.map(m => m.toUpperCase()));
  const sensitiveHeaders = new Set(config.sensitive_headers.map(h => h.toLowerCase()));

  /**
   * Express middleware function.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  return function captureMiddleware(req, res, next) {
    // Skip excluded paths
    const pathLower = req.path.toLowerCase();
    if (excludedPaths.has(pathLower) || _matchesExcludedPath(pathLower, config.excluded_paths)) {
      return next();
    }

    // Skip excluded methods
    if (excludedMethods.has(req.method.toUpperCase())) {
      return next();
    }

    const startTime = process.hrtime.bigint();
    const requestId = uuidv4();
    const timestamp = new Date().toISOString();

    // Attach request_id to the request object for downstream use
    req.requestId = requestId;

    // Capture request data synchronously (fast)
    const requestData = {
      request_id: requestId,
      timestamp,
      method: req.method,
      path: req.path,
      full_url: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
      client_ip: _getClientIp(req),
      user_agent: req.get('user-agent') || ''
    };

    // Conditionally capture request fields
    if (config.request_headers) {
      requestData.request_headers = config.mask_sensitive_data
        ? _maskHeaders(req.headers, sensitiveHeaders)
        : { ...req.headers };
    }

    if (config.request_query) {
      requestData.request_query = req.query && Object.keys(req.query).length > 0
        ? req.query
        : null;
    }

    if (config.request_body) {
      requestData.request_body = _captureBody(req.body, config.max_body_size_kb);
    }

    // Hook into res.end to capture response data after it's sent
    const originalEnd = res.end;
    const chunks = [];

    // Capture response body chunks if configured
    if (config.response_body) {
      const originalWrite = res.write;
      res.write = function (chunk, ...args) {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return originalWrite.apply(res, [chunk, ...args]);
      };
    }

    res.end = function (chunk, ...args) {
      // Restore original methods
      res.end = originalEnd;

      if (chunk && config.response_body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      // Call original end first — don't delay the response
      const result = originalEnd.apply(res, [chunk, ...args]);

      // Capture response data asynchronously
      const endTime = process.hrtime.bigint();
      const latencyMs = Number((endTime - startTime) / BigInt(1000000));

      const responseBody = config.response_body && chunks.length > 0
        ? _captureBody(_parseResponseBody(Buffer.concat(chunks)), config.max_body_size_kb)
        : null;

      const record = {
        ...requestData,
        status_code: res.statusCode,
        latency_ms: latencyMs,
        response_size_bytes: _getResponseSize(res, chunk, chunks),
        error_message: res.statusCode >= 400 ? (res.statusMessage || `HTTP ${res.statusCode}`) : null,
        stack_trace: res.statusCode >= 500 ? (res._errorStack || null) : null
      };

      if (config.response_headers) {
        const resHeaders = res.getHeaders ? res.getHeaders() : {};
        record.response_headers = config.mask_sensitive_data
          ? _maskHeaders(resHeaders, sensitiveHeaders)
          : resHeaders;
      }

      if (config.response_body) {
        record.response_body = responseBody;
      }

      // Persist asynchronously — fire and forget to avoid blocking
      setImmediate(() => {
        storage.save(record).catch(err => {
          console.error('[watchmen-logger] Failed to save request record:', err.message);
        });
      });

      return result;
    };

    next();
  };
}

// ─── Helper functions ──────────────────────────────────────────────────

/**
 * Check if a path matches any excluded path pattern (supports prefix matching).
 * @private
 * @param {string} path - Lowercase request path
 * @param {string[]} excludedPaths - Array of excluded path patterns
 * @returns {boolean}
 */
function _matchesExcludedPath(path, excludedPaths) {
  return excludedPaths.some(excluded => {
    const pattern = excluded.toLowerCase();
    if (pattern.endsWith('*')) {
      return path.startsWith(pattern.slice(0, -1));
    }
    return path === pattern;
  });
}

/**
 * Extract the real client IP, considering proxy headers.
 * @private
 * @param {import('express').Request} req
 * @returns {string}
 */
function _getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0];
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Mask sensitive header values.
 * @private
 * @param {object} headers - Headers object
 * @param {Set<string>} sensitiveSet - Set of lowercase header names to mask
 * @returns {object} Headers with sensitive values replaced by '[REDACTED]'
 */
function _maskHeaders(headers, sensitiveSet) {
  const masked = {};
  for (const [key, value] of Object.entries(headers)) {
    masked[key] = sensitiveSet.has(key.toLowerCase()) ? '[REDACTED]' : value;
  }
  return masked;
}

/**
 * Safely capture a body, respecting the max size limit.
 * @private
 * @param {*} body - The body to capture
 * @param {number} maxSizeKb - Maximum size in kilobytes
 * @returns {*} The captured body or a truncation message
 */
function _captureBody(body, maxSizeKb) {
  if (body == null) return null;

  try {
    const serialized = typeof body === 'string' ? body : JSON.stringify(body);
    const sizeBytes = Buffer.byteLength(serialized, 'utf8');
    const maxBytes = maxSizeKb * 1024;

    if (sizeBytes > maxBytes) {
      return `[TRUNCATED: body exceeds ${maxSizeKb}KB limit (${Math.round(sizeBytes / 1024)}KB)]`;
    }

    return body;
  } catch {
    return '[UNSERIALIZABLE_BODY]';
  }
}

/**
 * Attempt to parse response body from buffer.
 * @private
 * @param {Buffer} buffer - Response body buffer
 * @returns {*}
 */
function _parseResponseBody(buffer) {
  const str = buffer.toString('utf8');
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

/**
 * Calculate response size in bytes.
 * @private
 * @param {import('express').Response} res
 * @param {*} lastChunk
 * @param {Buffer[]} chunks
 * @returns {number}
 */
function _getResponseSize(res, lastChunk, chunks) {
  // Try content-length header first
  const contentLength = res.getHeader('content-length');
  if (contentLength) return parseInt(contentLength, 10);

  // Calculate from chunks
  if (chunks && chunks.length > 0) {
    return chunks.reduce((total, buf) => total + buf.length, 0);
  }

  // Estimate from last chunk
  if (lastChunk) {
    return Buffer.isBuffer(lastChunk) ? lastChunk.length : Buffer.byteLength(lastChunk);
  }

  return 0;
}

module.exports = createCaptureMiddleware;
