import { describe, it, expect } from 'vitest';
// Al apuntar a la carpeta 'utils', Node.js resolverá automáticamente el archivo 'index.js'
const { generateUUID, getISO8601Timestamp, maskSensitiveData } = require('../../src/utils');

describe('Módulo de Utilidades', () => {
  
  describe('generateUUID', () => {
    it('debe generar un UUID v4 válido', () => {
      const uuid = generateUUID();
      // Regex básica para validar el formato de un UUID v4
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      expect(uuid).toBeDefined();
      expect(typeof uuid).toBe('string');
      expect(uuid).toMatch(uuidRegex);
    });
  });

  describe('getISO8601Timestamp', () => {
    it('debe devolver una fecha en formato ISO 8601', () => {
      const timestamp = getISO8601Timestamp();
      const date = new Date(timestamp);
      
      expect(timestamp).toBeDefined();
      // Si la fecha es válida, getTime() no devolverá NaN
      expect(isNaN(date.getTime())).toBe(false);
      expect(timestamp).toBe(date.toISOString());
    });
  });

  describe('maskSensitiveData', () => {
    it('debe enmascarar las cabeceras sensibles por defecto', () => {
      const headers = {
        'content-type': 'application/json',
        'authorization': 'Bearer token-secreto',
        'cookie': 'session_id=12345'
      };

      const result = maskSensitiveData(headers);

      expect(result['content-type']).toBe('application/json');
      expect(result['authorization']).toBe('[REDACTED]');
      expect(result['cookie']).toBe('[REDACTED]');
    });

    it('no debe mutar el objeto original', () => {
      const original = { authorization: 'secreto' };
      const result = maskSensitiveData(original);
      
      expect(result.authorization).toBe('[REDACTED]');
      expect(original.authorization).toBe('secreto');
    });

    it('debe ser insensible a mayúsculas y minúsculas', () => {
      const headers = { 'Authorization': 'Bearer token' };
      const result = maskSensitiveData(headers);
      
      expect(result['Authorization']).toBe('[REDACTED]');
    });
  });
});