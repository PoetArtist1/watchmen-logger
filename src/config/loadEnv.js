/**
 * @module config/loadEnv
 * @description Load KEY=value pairs from a `.env` file into process.env
 * without overwriting variables already set in the environment (RF-06).
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse a `.env` file body into a plain object.
 * Supports comments (`#`), blank lines, optional quotes, and `export KEY=value`.
 *
 * @param {string} content - Raw file contents
 * @returns {Record<string, string>}
 */
function parseEnvContent(content) {
  /** @type {Record<string, string>} */
  const result = {};

  if (typeof content !== 'string' || content.length === 0) {
    return result;
  }

  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const withoutExport = line.startsWith('export ')
      ? line.slice('export '.length).trim()
      : line;

    const eqIndex = withoutExport.indexOf('=');
    if (eqIndex <= 0) {
      continue;
    }

    const key = withoutExport.slice(0, eqIndex).trim();
    let value = withoutExport.slice(eqIndex + 1).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }

    // Strip matching single or double quotes
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

/**
 * Load a `.env` file into `process.env`.
 * Existing system environment variables take priority and are never overwritten.
 *
 * @param {string} [envPath] - Absolute or relative path to `.env` (default: cwd/.env)
 * @param {object} [options]
 * @param {boolean} [options.required=false] - Throw if the file is missing
 * @returns {Record<string, string>} Variables loaded from the file (not including pre-existing env)
 */
function loadEnv(envPath = path.resolve(process.cwd(), '.env'), options = {}) {
  const { required = false } = options;
  const absolutePath = path.isAbsolute(envPath)
    ? envPath
    : path.resolve(process.cwd(), envPath);

  if (!fs.existsSync(absolutePath)) {
    if (required) {
      throw new Error(`[watchmen-logger] .env file not found at: ${absolutePath}`);
    }
    return {};
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  const parsed = parseEnvContent(content);
  /** @type {Record<string, string>} */
  const loaded = {};

  for (const [key, value] of Object.entries(parsed)) {
    // Priority: system env > .env file
    if (process.env[key] === undefined) {
      process.env[key] = value;
      loaded[key] = value;
    }
  }

  return loaded;
}

module.exports = {
  parseEnvContent,
  loadEnv
};
