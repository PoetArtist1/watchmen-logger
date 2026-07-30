/**
 * @module config/resolveEnv
 * @description Resolve `${VAR_NAME}` placeholders inside configuration values (RF-06).
 */

const ENV_REF_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/**
 * Resolve all `${VAR}` references in a string using `process.env`.
 * Fails fast with a clear message if any referenced variable is missing.
 *
 * @param {string} value
 * @param {string} [pathHint] - JSON path for error messages
 * @returns {string}
 * @throws {Error} When a referenced variable is undefined or empty
 */
function resolveEnvString(value, pathHint = '') {
  if (typeof value !== 'string') {
    return value;
  }

  const missing = [];
  const resolved = value.replace(ENV_REF_PATTERN, (match, varName) => {
    const envValue = process.env[varName];
    if (envValue === undefined || envValue === '') {
      missing.push(varName);
      return match;
    }
    return envValue;
  });

  if (missing.length > 0) {
    const where = pathHint ? ` at "${pathHint}"` : '';
    throw new Error(
      `[watchmen-logger] Missing environment variable(s)${where}: ${missing.join(', ')}. `
      + 'Define them in the system environment or in a .env file. See .env.example.'
    );
  }

  return resolved;
}

/**
 * Deep-walk a config tree and resolve `${VAR}` in every string value.
 *
 * @param {*} value
 * @param {string} [pathHint='']
 * @returns {*}
 */
function resolveEnvVars(value, pathHint = '') {
  if (typeof value === 'string') {
    return resolveEnvString(value, pathHint);
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      resolveEnvVars(item, pathHint ? `${pathHint}[${index}]` : `[${index}]`)
    );
  }

  if (value && typeof value === 'object') {
    /** @type {Record<string, *>} */
    const result = {};
    for (const [key, child] of Object.entries(value)) {
      const childPath = pathHint ? `${pathHint}.${key}` : key;
      result[key] = resolveEnvVars(child, childPath);
    }
    return result;
  }

  return value;
}

/**
 * Return whether a string still contains unresolved `${VAR}` placeholders.
 * @param {string} value
 * @returns {boolean}
 */
function hasEnvRefs(value) {
  if (typeof value !== 'string') {
    return false;
  }
  ENV_REF_PATTERN.lastIndex = 0;
  return ENV_REF_PATTERN.test(value);
}

module.exports = {
  ENV_REF_PATTERN,
  resolveEnvString,
  resolveEnvVars,
  hasEnvRefs
};
