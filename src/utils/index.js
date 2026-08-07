/**
 * @module utils
 * @description Shared utilities: UUID generation, ISO 8601 dates, sensitive-data masking,
 * and manual logging API.
 */

const { generateUuid } = require('./uuid');
const { nowISO8601, toISO8601, isISO8601 } = require('./dates');
const {
  REDACTED,
  DEFAULT_SENSITIVE_KEYS,
  maskHeaders,
  maskSensitiveData
} = require('./mask');
const {
  setStorageEngine,
  logInfo,
  logWarning,
  logError,
  logDebug
} = require('./manualLogger');

// Mario's aliases for backward compatibility
const generateUUID = generateUuid;
const getISO8601Timestamp = nowISO8601;

module.exports = {
  // David's modular utils
  generateUuid,
  nowISO8601,
  toISO8601,
  isISO8601,
  REDACTED,
  DEFAULT_SENSITIVE_KEYS,
  maskHeaders,
  maskSensitiveData,

  // Mario's manual logger
  setStorageEngine,
  logInfo,
  logWarning,
  logError,
  logDebug,

  // Aliases (Mario's naming convention)
  generateUUID,
  getISO8601Timestamp
};
