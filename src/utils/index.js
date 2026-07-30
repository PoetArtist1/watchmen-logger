/**
 * @module utils
 * @description Shared utilities: UUID generation, ISO 8601 dates, sensitive-data masking.
 */

const { generateUuid } = require('./uuid');
const { nowISO8601, toISO8601, isISO8601 } = require('./dates');
const {
  REDACTED,
  DEFAULT_SENSITIVE_KEYS,
  maskHeaders,
  maskSensitiveData
} = require('./mask');

module.exports = {
  generateUuid,
  nowISO8601,
  toISO8601,
  isISO8601,
  REDACTED,
  DEFAULT_SENSITIVE_KEYS,
  maskHeaders,
  maskSensitiveData
};
