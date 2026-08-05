const fs = require('fs');
const path = require('path');

/**
 * Carga manualmente las variables de un archivo .env en process.env.
 * Esto evita depender de librerías externas como 'dotenv'.
 * 
 * @param {string} envPath - Ruta al archivo .env
 */
function loadEnvVariables(envPath = path.resolve(process.cwd(), '.env')) {
  if (!fs.existsSync(envPath)) return;

  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    // Ignorar líneas vacías o comentarios
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) return;

    // Extraer clave y valor (ej. DB_PASS=secreto123)
    const match = trimmedLine.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      
      // Remover comillas si el valor está envuelto en ellas
      if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }

      // Solo asignar si no existe previamente en process.env (las del sistema tienen prioridad)
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

/**
 * Busca patrones ${VAR_NAME} en un string y los reemplaza por su valor en process.env.
 * Lanza un error si la variable no está definida.
 * 
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
 * 
 * @param {Object} obj - El objeto de configuración
 * @returns {Object} El objeto mutado con los valores inyectados
 */
function interpolateConfig(obj) {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // 1. Interpolar el valor
      const interpolatedValue = interpolateString(obj[key]);
      
      // 2. Transformar los tipos de manera segura y excluyente
      if (interpolatedValue === 'true') {
        obj[key] = true;
      } else if (interpolatedValue === 'false') {
        obj[key] = false;
      } else if (!isNaN(interpolatedValue) && interpolatedValue.trim() !== '') {
        obj[key] = Number(interpolatedValue);
      } else {
        // Si no es ni booleano ni número, lo guardamos como string
        obj[key] = interpolatedValue;
      }
      
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      // Llamada recursiva para objetos anidados
      interpolateConfig(obj[key]);
    }
  }
  return obj;
}

/**
 * Valida la estructura y tipos requeridos del JSON de configuración.
 * 
 * @param {Object} config - El objeto de configuración ya interpolado
 */
function validateConfig(config) {
  if (!config.storage || !config.storage.strategy) {
    throw new Error(`[watchmen-logger] Config Error: Falta 'storage.strategy' en la configuración.`);
  }

  const validStrategies = ['memory', 'sqlite', 'postgresql'];
  if (!validStrategies.includes(config.storage.strategy)) {
    throw new Error(`[watchmen-logger] Config Error: Estrategia '${config.storage.strategy}' no es válida.`);
  }

  if (config.storage.strategy === 'sqlite' && (!config.storage.config || !config.storage.config.database_path)) {
    throw new Error(`[watchmen-logger] Config Error: Estrategia SQLite requiere 'database_path'.`);
  }

  // Agrega más validaciones según los requerimientos estrictos si es necesario
}

/**
 * Orquestador principal: Carga el .env, lee el JSON, interpola y valida.
 * 
 * @param {string} configPath - Ruta al archivo logger.config.json
 * @returns {Object} La configuración final validada
 */
function loadConfiguration(configPath = path.resolve(process.cwd(), 'logger.config.json')) {
  // 1. Cargar variables de entorno
  loadEnvVariables();

  // 2. Leer archivo JSON
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

  // 3. Inyectar variables de entorno (Requisito RF-06)
  const finalConfig = interpolateConfig(rawConfig);

  // 4. Validar tipos e integridad
  validateConfig(finalConfig);

  return finalConfig;
}

module.exports = {
  loadConfiguration,
  loadEnvVariables,
  interpolateString,
  validateConfig
};