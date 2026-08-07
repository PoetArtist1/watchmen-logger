/**
 * @module config
 * @description Configuration loading, `.env` injection and validation (RF-06).
 *
 * Combines the modular config pipeline (loadConfig, loadEnv, resolveEnv, validate)
 * with the simplified loadConfiguration helper.
 */

const fs = require('fs');
const path = require('path');
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

// ── Mario's simplified config loader (RF-06) ──────────────────────

/**
 * Carga manualmente las variables de un archivo .env en process.env.
 * @param {string} envPath - Ruta al archivo .env
 */
function loadEnvVariables(envPath = path.resolve(process.cwd(), '.env')) {
  if (!fs.existsSync(envPath)) return;

  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) return;

    const match = trimmedLine.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();

      if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

/**
 * Busca patrones ${VAR_NAME} en un string y los reemplaza por su valor en process.env.
 * @param {string} text - El texto a procesar
 * @returns {string} El texto con las variables inyectadas
 */
function interpolateString(text) {
  if (typeof text !== 'string') return text;

  return text.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    const value = process.env[varName];
    if (value === undefined) {
      throw new Error(`[watchmen-logger] Config Error: La variable de entorno '${varName}' no está definida.`);
    }
    return value;
  });
}

/**
 * Recorre recursivamente un objeto inyectando variables de entorno en sus valores string.
 * @param {Object} obj - El objeto de configuración
 * @returns {Object} El objeto mutado con los valores inyectados
 */
function interpolateConfig(obj) {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      const interpolatedValue = interpolateString(obj[key]);

      if (interpolatedValue === 'true') {
        obj[key] = true;
      } else if (interpolatedValue === 'false') {
        obj[key] = false;
      } else if (!isNaN(interpolatedValue) && interpolatedValue.trim() !== '') {
        obj[key] = Number(interpolatedValue);
      } else {
        obj[key] = interpolatedValue;
      }

    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      interpolateConfig(obj[key]);
    }
  }
  return obj;
}

/**
 * Orquestador principal: Carga el .env, lee el JSON, interpola y valida.
 * @param {string} configPath - Ruta al archivo logger.config.json
 * @returns {Object} La configuración final validada
 */
function loadConfiguration(configPath = path.resolve(process.cwd(), 'logger.config.json')) {
  loadEnvVariables();

  if (!fs.existsSync(configPath)) {
    throw new Error(`[watchmen-logger] Config Error: No se encontró el archivo ${configPath}`);
  }

  let rawConfig;
  try {
    const fileContent = fs.readFileSync(configPath, 'utf8');
    rawConfig = JSON.parse(fileContent);
  } catch (error) {
    throw new Error(`[watchmen-logger] Config Error: El archivo JSON es inválido. ${error.message}`);
  }

  const finalConfig = interpolateConfig(rawConfig);
  validateConfig(finalConfig);

  return finalConfig;
}

// ── Combined exports ───────────────────────────────────────────────

module.exports = {
  // David's modular config pipeline
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
  POSTGRES_STORAGE_DEFAULTS,

  // Mario's simplified loader
  loadConfiguration,
  loadEnvVariables,
  interpolateString
};
