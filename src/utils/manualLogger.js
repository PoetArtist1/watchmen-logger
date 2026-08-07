const { generateUuid: generateUUID } = require('./uuid');
const { nowISO8601: getISO8601Timestamp } = require('./dates');

// Referencia a la estrategia de almacenamiento activa
let activeStorage = null;

/**
 * Permite vincular la estrategia de almacenamiento activa al logger manual.
 * 
 * @param {Object} storageInstance - Instancia de la estrategia de almacenamiento (Memory, Sqlite, Postgres)
 */
function setStorageEngine(storageInstance) {
  activeStorage = storageInstance;
}

/**
 * Construye el objeto de log estructurado y lo persiste en la estrategia activa.
 * 
 * @param {string} level - Nivel de severidad ('info', 'warning', 'error', 'debug')
 * @param {string} message - Mensaje descriptivo
 * @param {Object} [metadata={}] - Información adicional contextual
 * @param {string|null} [stack=null] - Stack trace si aplica
 * @returns {Promise<Object>} El objeto de log creado
 */
async function dispatchLog(level, message, metadata = {}, stack = null) {
  const logEntry = {
    id: generateUUID(),
    timestamp: getISO8601Timestamp(),
    level,
    message,
    metadata,
    stack
  };

  if (activeStorage && typeof activeStorage.save === 'function') {
    try {
      await activeStorage.save(logEntry);
    } catch (err) {
      console.error('[watchmen-logger] Error guardando log manual:', err.message);
    }
  }

  return logEntry;
}

/**
 * Registra un evento de nivel Informativo.
 */
async function logInfo(message, metadata = {}) {
  return dispatchLog('info', message, metadata);
}

/**
 * Registra un evento de nivel Advertencia.
 */
async function logWarning(message, metadata = {}) {
  return dispatchLog('warning', message, metadata);
}

/**
 * Registra un evento de nivel Error.
 * Si recibe una instancia de Error, extrae automáticamente su mensaje y stack trace.
 */
async function logError(errorOrMessage, metadata = {}) {
  let message = errorOrMessage;
  let stack = null;

  if (errorOrMessage instanceof Error) {
    message = errorOrMessage.message;
    stack = errorOrMessage.stack || null;
  }

  return dispatchLog('error', message, metadata, stack);
}

/**
 * Registra un evento de nivel Depuración.
 */
async function logDebug(message, metadata = {}) {
  return dispatchLog('debug', message, metadata);
}

module.exports = {
  setStorageEngine,
  logInfo,
  logWarning,
  logError,
  logDebug
};