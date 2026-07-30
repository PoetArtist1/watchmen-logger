/**
 * @module config
 * @description Configuration loading, `.env` injection and validation (RF-06).
 */

const { loadConfig } = require('./loadConfig');
const { loadEnv, parseEnvContent } = require('./loadEnv');
const { resolveEnvVars, resolveEnvString, hasEnvRefs } = require('./resolveEnv');
const { validateConfig, deepMerge, VALID_STRATEGIES } = require('./validate');
const {
  DEFAULT_CONFIG,
  MEMORY_STORAGE_DEFAULTS,
  SQLITE_STORAGE_DEFAULTS,
  POSTGRES_STORAGE_DEFAULTS
} = require('./defaults');

module.exports = {
  loadConfig,
  loadEnv,
  parseEnvContent,
  resolveEnvVars,
  resolveEnvString,
  hasEnvRefs,
  validateConfig,
  deepMerge,
  VALID_STRATEGIES,
  DEFAULT_CONFIG,
  MEMORY_STORAGE_DEFAULTS,
  SQLITE_STORAGE_DEFAULTS,
  POSTGRES_STORAGE_DEFAULTS
};
