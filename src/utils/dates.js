/**
 * @module utils/dates
 * @description ISO 8601 datetime helpers for request/log timestamps.
 */

/**
 * Return the current time as an ISO 8601 string (UTC).
 * @returns {string} e.g. "2026-07-29T21:30:00.000Z"
 */
function nowISO8601() {
  return new Date().toISOString();
}

/**
 * Convert a Date, timestamp (ms), or date string to ISO 8601.
 * @param {Date|number|string} [value] - Value to format; defaults to now
 * @returns {string} ISO 8601 datetime string
 * @throws {TypeError} If the value cannot be parsed as a valid date
 */
function toISO8601(value = Date.now()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`Invalid date value: ${String(value)}`);
  }

  return date.toISOString();
}

/**
 * Check whether a string is a valid ISO 8601 datetime.
 * @param {string} value
 * @returns {boolean}
 */
function isISO8601(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return false;
  }

  // Accept common ISO forms produced by Date#toISOString and timezone offsets
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.test(value);
}

module.exports = {
  nowISO8601,
  toISO8601,
  isISO8601
};
