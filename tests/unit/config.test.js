import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const fs = require('fs');
const { 
  loadEnvVariables, 
  interpolateString, 
  validateConfig, 
  loadConfiguration,
  DEFAULT_CONFIG
} = require('../../src/config');

// Helper: create a minimal valid config for David's strict validator
function validConfig(overrides = {}) {
  return {
    storage: { strategy: 'memory', config: { max_records: 5000, cleanup_enabled: true, cleanup_interval_minutes: 10, cleanup_older_than_hours: 24 } },
    capture: { ...DEFAULT_CONFIG.capture },
    monitoring: { ...DEFAULT_CONFIG.monitoring },
    ...overrides
  };
}

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
    it('debe pasar con una configuración válida completa', () => {
      const config = validConfig();
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('debe fallar si falta storage', () => {
      const badConfig = validConfig();
      delete badConfig.storage;
      expect(() => validateConfig(badConfig)).toThrow(/storage/);
    });

    it('debe fallar con una estrategia no soportada', () => {
      const badConfig = validConfig({ storage: { strategy: 'mongodb' } });
      expect(() => validateConfig(badConfig)).toThrow(/storage.strategy/);
    });

    it('debe fallar si falta capture', () => {
      const badConfig = validConfig();
      delete badConfig.capture;
      expect(() => validateConfig(badConfig)).toThrow(/capture/);
    });

    it('debe fallar si falta monitoring', () => {
      const badConfig = validConfig();
      delete badConfig.monitoring;
      expect(() => validateConfig(badConfig)).toThrow(/monitoring/);
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
                ssl: 'true',
                host: 'localhost',
                database: 'testdb',
                user: 'admin',
                pool_size: 10
              }
            },
            capture: DEFAULT_CONFIG.capture,
            monitoring: DEFAULT_CONFIG.monitoring
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