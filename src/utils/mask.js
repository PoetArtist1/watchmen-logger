/**
 * @module utils/mask
 * @description Mask sensitive values (passwords, cookies, auth headers, etc.)
 * before they are persisted or logged.
 */

/** @type {ReadonlySet<string>} */
const DEFAULT_SENSITIVE_KEYS = new Set([
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'api_key',
  'apikey',
  'authorization',
  'cookie',
  'cookies',
  'set-cookie',
  'set_cookie',
  'x-api-key',
  'credit_card',
  'creditcard',
  'ssn'
]);

const REDACTED = '[REDACTED]';

/**
 * Mask sensitive HTTP headers.
 * @param {object} headers - Headers object (keys may be mixed case)
 * @param {string[]|Set<string>} [sensitiveHeaders] - Header names to mask
 * @returns {object} Shallow copy with sensitive values replaced by `[REDACTED]`
 */
function maskHeaders(headers, sensitiveHeaders = ['authorization', 'cookie', 'set-cookie']) {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  const sensitiveSet = sensitiveHeaders instanceof Set
    ? sensitiveHeaders
    : new Set(sensitiveHeaders.map((h) => String(h).toLowerCase()));

  const masked = {};
  for (const [key, value] of Object.entries(headers)) {
    masked[key] = sensitiveSet.has(key.toLowerCase()) ? REDACTED : value;
  }
  return masked;
}

/**
 * Recursively mask sensitive keys in plain objects / arrays.
 *
 * @param {*} data - Value to sanitize
 * @param {object} [options]
 * @param {string[]} [options.sensitiveKeys] - Extra key names to treat as sensitive
 * @param {number} [options.maxDepth=10] - Max recursion depth
 * @returns {*} Sanitized copy of `data`
 */
function maskSensitiveData(data, options = {}) {
  const {
    sensitiveKeys = [],
    maxDepth = 10
  } = options;

  const keys = new Set([
    ...DEFAULT_SENSITIVE_KEYS,
    ...sensitiveKeys.map((k) => String(k).toLowerCase())
  ]);

  return _maskValue(data, keys, maxDepth, 0);
}

/**
 * @private
 */
function _maskValue(value, keys, maxDepth, depth) {
  if (value == null || depth > maxDepth) {
    return value;
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => _maskValue(item, keys, maxDepth, depth + 1));
  }

  // Avoid mutating Date / Buffer / Error etc.
  if (value instanceof Date || Buffer.isBuffer(value) || value instanceof Error) {
    return value;
  }

  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (keys.has(key.toLowerCase())) {
      result[key] = REDACTED;
    } else {
      result[key] = _maskValue(child, keys, maxDepth, depth + 1);
    }
  }
  return result;
}

module.exports = {
  REDACTED,
  DEFAULT_SENSITIVE_KEYS,
  maskHeaders,
  maskSensitiveData
};
