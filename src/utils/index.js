const crypto = require('crypto');

/**
 * Genera un identificador único UUID v4.
 * Requerido para etiquetar de forma única cada request y log manual.
 * 
 * @returns {string} UUID v4
 */
function generateUUID() {
  // Utilizamos el método nativo de Node.js (disponible desde v15.6.0)
  return crypto.randomUUID();
}

/**
 * Devuelve la fecha y hora actual en formato estándar ISO 8601.
 * 
 * @returns {string} Fecha en formato ISO 8601
 */
function getISO8601Timestamp() {
  return new Date().toISOString();
}

/**
 * Enmascara valores sensibles en un objeto (ej. headers de una petición).
 * Reemplaza el valor de las claves coincidentes por '[REDACTED]'.
 * 
 * @param {Object} data - El objeto a procesar (ej. req.headers).
 * @param {string[]} sensitiveKeys - Lista de claves a ocultar (en minúsculas).
 * @returns {Object} Un nuevo objeto con los datos sensibles ocultos.
 */
function maskSensitiveData(data, sensitiveKeys = ['authorization', 'cookie', 'set-cookie']) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  // Creamos una copia superficial para no mutar el objeto original
  const maskedData = { ...data };
  
  for (const key in maskedData) {
    if (Object.prototype.hasOwnProperty.call(maskedData, key)) {
      // Normalizamos la clave a minúsculas para una comparación segura
      if (sensitiveKeys.includes(key.toLowerCase())) {
        maskedData[key] = '[REDACTED]';
      } else if (typeof maskedData[key] === 'object' && maskedData[key] !== null) {
        // (Opcional) Llamada recursiva por si hay datos anidados sensibles en un body
        maskedData[key] = maskSensitiveData(maskedData[key], sensitiveKeys);
      }
    }
  }
  
  return maskedData;
}

module.exports = {
  generateUUID,
  getISO8601Timestamp,
  maskSensitiveData
};