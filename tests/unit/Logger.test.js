/**
 * Unit tests for WatchmenLogger manual logging API (RF-05).
 */

const { createLogger, WatchmenLogger, LOG_LEVELS } = require('../../src/Logger');
const { MemoryStorage } = require('../../src/storage');
const { DEFAULT_CONFIG } = require('../../src/config');

describe('WatchmenLogger', () => {
  /** @type {MemoryStorage} */
  let storage;
  /** @type {WatchmenLogger} */
  let logger;

  beforeEach(async () => {
    storage = new MemoryStorage({ max_records: 100 });
    await storage.initialize();
    logger = new WatchmenLogger({
      config: structuredClone(DEFAULT_CONFIG),
      storage
    });
  });

  afterEach(async () => {
    await logger.close();
  });

  it('logInfo persists an INFO entry with timestamp and id', async () => {
    const entry = await logger.logInfo('hello', { route: '/x' });
    expect(entry.level).toBe(LOG_LEVELS.INFO);
    expect(entry.message).toBe('hello');
    expect(entry.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(entry.metadata).toEqual({ route: '/x' });

    const { data } = await storage.findLogs();
    expect(data).toHaveLength(1);
    expect(data[0].message).toBe('hello');
  });

  it('logWarning and logDebug use the correct levels', async () => {
    await logger.logWarning('careful');
    await logger.logDebug('dbg');
    const { data } = await storage.findLogs({}, { limit: 10, order: 'asc' });
    expect(data.map((l) => l.level)).toEqual(['WARNING', 'DEBUG']);
  });

  it('logError captures stack from Error objects', async () => {
    const err = new Error('boom');
    const entry = await logger.logError('failed', err, { code: 500 });
    expect(entry.level).toBe('ERROR');
    expect(entry.stack_trace).toContain('boom');
    expect(entry.metadata.code).toBe(500);
  });

  it('logError(message, metadata) treats plain object as metadata', async () => {
    const entry = await logger.logError('failed', { orderId: 9 });
    expect(entry.metadata).toEqual({ orderId: 9 });
    expect(entry.stack_trace).toBeNull();
  });

  it('masks sensitive metadata by default', async () => {
    const entry = await logger.logInfo('login', { password: 'secret', user: 'a' });
    expect(entry.metadata.password).toBe('[REDACTED]');
    expect(entry.metadata.user).toBe('a');
  });

  it('rejects empty messages', async () => {
    await expect(logger.logInfo('')).rejects.toThrow(/non-empty string/);
  });

  it('createLogger bootstraps with injected storage', async () => {
    const created = await createLogger({
      storage,
      loadDotEnv: false,
      configPath: '___missing_logger_config__.json'
    });
    expect(created).toBeInstanceOf(WatchmenLogger);
    await created.logInfo('from createLogger');
    const { data } = await storage.findLogs();
    expect(data.some((l) => l.message === 'from createLogger')).toBe(true);
    // storage shared — do not close via created.close() twice in afterEach
    created._closed = true;
  });

  it('deprecated log() warns once and delegates', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    WatchmenLogger._logWarned = false;

    await logger.log('warning', 'legacy');
    await logger.log('info', 'legacy2');

    expect(warn).toHaveBeenCalledTimes(1);
    const { data } = await storage.findLogs({}, { order: 'asc' });
    expect(data.map((l) => l.level)).toEqual(['WARNING', 'INFO']);

    warn.mockRestore();
  });

  it('middleware() returns an Express-compatible function', () => {
    const mw = logger.middleware();
    expect(typeof mw).toBe('function');
    expect(mw.length).toBe(3);
  });
});
