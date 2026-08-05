import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const fs = require('fs');
const { 
  loadEnvVariables, 
  interpolateString, 
  validateConfig, 
  loadConfiguration 
} = require('../../src/config');

describe('Gestor de Configuración (config/index.js)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('interpolateString', () => {
    it('debe reemplazar una variable de entorno correctamente', () => {
      process.env.TEST_VAR = 'secreto123';
      const result = interpolateString('La clave es ${TEST_VAR}');
      expect(result).toBe('La clave es secreto123');
    });

    it('debe lanzar un error si la variable no está definida', () => {
      expect(() => interpolateString('${VAR_INEXISTENTE}')).toThrow(
        "[watchmen-logger] Config Error: La variable de entorno 'VAR_INEXISTENTE' no está definida."
      );
    });

    it('debe devolver el texto original si no hay patrones', () => {
      const result = interpolateString('texto normal sin variables');
      expect(result).toBe('texto normal sin variables');
    });
  });

  describe('loadEnvVariables', () => {
    it('debe leer y asignar variables desde un archivo .env simulado', () => {
      const mockEnvContent = `
        # Comentario ignorado
        FOO=bar
        BAZ="qux"
      `;
      
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(mockEnvContent);

      loadEnvVariables();

      expect(process.env.FOO).toBe('bar');
      expect(process.env.BAZ).toBe('qux');
    });
  });

  describe('validateConfig', () => {
    it('debe pasar con una configuración válida', () => {
      const validConfig = {
        storage: { strategy: 'memory' }
      };
      expect(() => validateConfig(validConfig)).not.toThrow();
    });

    it('debe fallar si falta storage.strategy', () => {
      expect(() => validateConfig({ storage: {} })).toThrow(/Falta 'storage.strategy'/);
    });

    it('debe fallar con una estrategia no soportada', () => {
      const invalidConfig = { storage: { strategy: 'mongodb' } };
      expect(() => validateConfig(invalidConfig)).toThrow(/no es válida/);
    });

    it('debe fallar si la estrategia es sqlite pero falta el path', () => {
      const invalidSqlite = { storage: { strategy: 'sqlite', config: {} } };
      expect(() => validateConfig(invalidSqlite)).toThrow(/requiere 'database_path'/);
    });
  });

  describe('loadConfiguration', () => {
    it('debe orquestar la carga, interpolación y validación correctamente', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      
      vi.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
        if (filePath.endsWith('.env')) {
          return 'DB_PASS=supersecreto\nPORT=5432';
        }
        if (filePath.endsWith('.json')) {
          return JSON.stringify({
            storage: {
              strategy: 'postgresql',
              config: {
                password: '${DB_PASS}',
                port: '${PORT}',
                ssl: 'true'
              }
            }
          });
        }
        return '';
      });

      const config = loadConfiguration('dummy.json');

      expect(config.storage.strategy).toBe('postgresql');
      expect(config.storage.config.password).toBe('supersecreto');
      expect(config.storage.config.port).toBe(5432);
      expect(config.storage.config.ssl).toBe(true);
    });
  });
});