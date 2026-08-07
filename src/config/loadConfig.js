/**
 * @module config/loadConfig
 * @description Load `logger.config.json`, inject `.env` secrets, resolve `${VAR}`
 * placeholders and validate types at startup (RF-06).
 */

const fs = require('fs');
const path = require('path');
const { loadEnv } = require('./loadEnv');
const { resolveEnvVars } = require('./resolveEnv');
const { validateConfig, deepMerge } = require('./validate');
const { DEFAULT_CONFIG } = require('./defaults');

/**
 * Load, resolve and validate the logger configuration.
 *
 * Priority for secrets: system environment > `.env` file > defaults in JSON.
 * Missing `${VAR}` references fail immediately at startup with a clear message.
 *
 * @param {object} [options]
 * @param {string} [options.configPath] - Path to logger.config.json
 * @param {string} [options.envPath] - Path to .env file
 * @param {boolean} [options.loadDotEnv=true] - Whether to load .env into process.env
 * @param {object} [options.overrides] - Optional in-memory overrides (merged last)
 * @returns {object} Validated configuration
 *
 * @example
 * const config = loadConfig();
 * // or
 * const config = loadConfig({ configPath: './custom.config.json' });
 */
function loadConfig(options = {}) {
  const {
    configPath = path.resolve(process.cwd(), 'logger.config.json'),
    envPath = path.resolve(process.cwd(), '.env'),
    loadDotEnv = true,
    overrides
  } = options;

  if (loadDotEnv) {
    loadEnv(envPath, { required: false });
  }

  const absoluteConfigPath = path.isAbsolute(configPath)
    ? configPath
    : path.resolve(process.cwd(), configPath);

  let fileConfig = {};

  if (fs.existsSync(absoluteConfigPath)) {
    let raw;
    try {
      raw = fs.readFileSync(absoluteConfigPath, 'utf8');
    } catch (err) {
      throw new Error(
        `[watchmen-logger] Unable to read config file at ${absoluteConfigPath}: ${err.message}`
      );
    }

    try {
      fileConfig = JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `[watchmen-logger] Invalid JSON in ${absoluteConfigPath}: ${err.message}`
      );
    }

    if (!fileConfig || typeof fileConfig !== 'object' || Array.isArray(fileConfig)) {
      throw new Error(
        `[watchmen-logger] Config file must contain a JSON object: ${absoluteConfigPath}`
      );
    }
  } else {
    // Sensible out-of-the-box defaults when no config file is present (RF-01)
    fileConfig = {};
  }

  // Merge defaults ← file ← overrides, then resolve env placeholders
  let merged = deepMerge(DEFAULT_CONFIG, fileConfig);
  if (overrides && typeof overrides === 'object') {
    merged = deepMerge(merged, overrides);
  }

  const resolved = resolveEnvVars(merged);
  return validateConfig(resolved);
}

module.exports = {
  loadConfig
};
