import { describe, it, expect, vi, beforeEach } from 'vitest';
const { 
  setStorageEngine, 
  logInfo, 
  logWarning, 
  logError, 
  logDebug 
} = require('../../src/utils/manualLogger');

describe('API de Logging Manual (manualLogger.js)', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = {
      save: vi.fn().mockResolvedValue(true)
    };
    setStorageEngine(mockStorage);
  });

  it('logInfo debe registrar un mensaje con nivel info', async () => {
    const log = await logInfo('Usuario autenticado', { userId: 42 });

    expect(log.level).toBe('info');
    expect(log.message).toBe('Usuario autenticado');
    expect(log.metadata.userId).toBe(42);
    expect(mockStorage.save).toHaveBeenCalledWith(log);
  });

  it('logWarning debe registrar un mensaje con nivel warning', async () => {
    const log = await logWarning('Uso de CPU alto');

    expect(log.level).toBe('warning');
    expect(log.message).toBe('Uso de CPU alto');
    expect(mockStorage.save).toHaveBeenCalledWith(log);
  });

  it('logError debe procesar un objeto Error extrayendo el stack trace', async () => {
    const errorSimulado = new Error('Conexión fallida a la BD');
    const log = await logError(errorSimulado, { retryCount: 3 });

    expect(log.level).toBe('error');
    expect(log.message).toBe('Conexión fallida a la BD');
    expect(log.stack).toBeDefined();
    expect(typeof log.stack).toBe('string');
    expect(log.metadata.retryCount).toBe(3);
  });

  it('logError debe aceptar un string simple como mensaje', async () => {
    const log = await logError('Error de timeout simple');

    expect(log.level).toBe('error');
    expect(log.message).toBe('Error de timeout simple');
    expect(log.stack).toBeNull();
  });

  it('logDebug debe registrar un mensaje con nivel debug', async () => {
    const log = await logDebug('Variables de proceso cargadas');

    expect(log.level).toBe('debug');
    expect(log.message).toBe('Variables de proceso cargadas');
  });
});