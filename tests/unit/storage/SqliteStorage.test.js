/**
 * @file Unit tests for SqliteStorage
 * Tests table creation, CRUD, indexing, pagination, filtering, metrics, and cleanup.
 */


const path = require('path');
const fs = require('fs');
const SqliteStorage = require('../../../src/storage/SqliteStorage');

const TEST_DB_PATH = path.join(__dirname, '..', '..', '..', 'test_sqlite.db');

/**
 * Helper to create a sample request record.
 */
function createRecord(overrides = {}) {
  return {
    request_id: overrides.request_id || `req-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: overrides.timestamp || new Date().toISOString(),
    method: overrides.method || 'GET',
    path: overrides.path || '/api/test',
    full_url: overrides.full_url || 'http://localhost:3000/api/test',
    status_code: overrides.status_code || 200,
    latency_ms: overrides.latency_ms || 15,
    client_ip: overrides.client_ip || '127.0.0.1',
    user_agent: overrides.user_agent || 'test-agent',
    request_headers: overrides.request_headers || { 'content-type': 'application/json' },
    request_query: overrides.request_query || null,
    request_body: overrides.request_body || null,
    response_headers: overrides.response_headers || {},
    response_body: overrides.response_body || null,
    response_size_bytes: overrides.response_size_bytes || 256,
    error_message: overrides.error_message || null,
    ...overrides
  };
}

describe('SqliteStorage', () => {
  let storage;

  beforeEach(async () => {
    // Remove test database if exists
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    storage = new SqliteStorage({ database_path: TEST_DB_PATH });
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
    // Clean up test database
    try {
      if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
      if (fs.existsSync(TEST_DB_PATH + '-wal')) fs.unlinkSync(TEST_DB_PATH + '-wal');
      if (fs.existsSync(TEST_DB_PATH + '-shm')) fs.unlinkSync(TEST_DB_PATH + '-shm');
    } catch { /* ignore cleanup errors */ }
  });

  // ─── Initialization ──────────────────────────────────────────────

  describe('initialize()', () => {
    it('should create the database file', () => {
      expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
    });

    it('should create the requests table', () => {
      const tables = storage.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='requests'"
      ).all();
      expect(tables.length).toBe(1);
    });

    it('should create the manual_logs table', () => {
      const tables = storage.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='manual_logs'"
      ).all();
      expect(tables.length).toBe(1);
    });

    it('should create required indices', () => {
      const indices = storage.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"
      ).all();
      const indexNames = indices.map(i => i.name);

      expect(indexNames).toContain('idx_requests_timestamp');
      expect(indexNames).toContain('idx_requests_path');
      expect(indexNames).toContain('idx_requests_status_code');
      expect(indexNames).toContain('idx_requests_method');
      expect(indexNames).toContain('idx_requests_latency');
    });

    it('should create directory if it does not exist', async () => {
      const nestedPath = path.join(__dirname, '..', '..', '..', 'test_nested', 'deep', 'test.db');
      const nested = new SqliteStorage({ database_path: nestedPath });
      await nested.initialize();
      expect(fs.existsSync(nestedPath)).toBe(true);
      await nested.close();

      // Cleanup
      fs.unlinkSync(nestedPath);
      fs.rmdirSync(path.dirname(nestedPath));
      fs.rmdirSync(path.join(__dirname, '..', '..', '..', 'test_nested', 'deep').replace(/deep$/, '').replace(/\\$/, ''));
    });
  });

  // ─── save() ──────────────────────────────────────────────────────

  describe('save()', () => {
    it('should save a record to the database', async () => {
      const record = createRecord({ request_id: 'sqlite-test-1' });
      await storage.save(record);

      const found = await storage.findById('sqlite-test-1');
      expect(found).not.toBeNull();
      expect(found.request_id).toBe('sqlite-test-1');
    });

    it('should serialize JSON fields', async () => {
      const record = createRecord({
        request_id: 'json-test',
        request_headers: { 'x-custom': 'value' },
        request_query: { page: '1' }
      });
      await storage.save(record);

      const found = await storage.findById('json-test');
      expect(found.request_headers).toEqual({ 'x-custom': 'value' });
      expect(found.request_query).toEqual({ page: '1' });
    });

    it('should handle null optional fields', async () => {
      const record = createRecord({
        request_id: 'null-test',
        request_body: null,
        response_body: null,
        error_message: null
      });
      await storage.save(record);

      const found = await storage.findById('null-test');
      expect(found).not.toBeNull();
      expect(found.request_body).toBeNull();
    });
  });

  // ─── findAll() ───────────────────────────────────────────────────

  describe('findAll()', () => {
    beforeEach(async () => {
      const ts = (i) => new Date(Date.now() + i * 1000).toISOString();
      await storage.save(createRecord({ request_id: 'r1', method: 'GET', status_code: 200, path: '/api/users', latency_ms: 10, timestamp: ts(0) }));
      await storage.save(createRecord({ request_id: 'r2', method: 'POST', status_code: 201, path: '/api/users', latency_ms: 50, timestamp: ts(1) }));
      await storage.save(createRecord({ request_id: 'r3', method: 'GET', status_code: 404, path: '/api/products', latency_ms: 5, timestamp: ts(2) }));
      await storage.save(createRecord({ request_id: 'r4', method: 'DELETE', status_code: 500, path: '/api/users/1', latency_ms: 200, timestamp: ts(3) }));
    });

    it('should return all records with no filters', async () => {
      const result = await storage.findAll();
      expect(result.data.length).toBe(4);
    });

    it('should filter by method', async () => {
      const result = await storage.findAll({ method: 'GET' });
      expect(result.data.length).toBe(2);
    });

    it('should filter by status_code', async () => {
      const result = await storage.findAll({ status_code: 404 });
      expect(result.data.length).toBe(1);
    });

    it('should filter by path', async () => {
      const result = await storage.findAll({ path: 'products' });
      expect(result.data.length).toBe(1);
    });

    it('should filter by has_error', async () => {
      const result = await storage.findAll({ has_error: true });
      expect(result.data.length).toBe(2);
    });

    it('should paginate with limit', async () => {
      const result = await storage.findAll({}, { limit: 2 });
      expect(result.data.length).toBe(2);
      expect(result.pagination.has_more).toBe(true);
    });

    it('should paginate with cursor', async () => {
      const page1 = await storage.findAll({}, { limit: 2 });
      const page2 = await storage.findAll({}, { limit: 2, cursor: page1.pagination.next_cursor });

      expect(page2.data.length).toBe(2);
      const page1Ids = page1.data.map(r => r.request_id);
      const page2Ids = page2.data.map(r => r.request_id);
      expect(page1Ids.some(id => page2Ids.includes(id))).toBe(false);
    });

    it('should include total_count', async () => {
      const result = await storage.findAll();
      expect(result.pagination.total_count).toBe(4);
    });
  });

  // ─── getMetrics() ────────────────────────────────────────────────

  describe('getMetrics()', () => {
    beforeEach(async () => {
      await storage.save(createRecord({ method: 'GET', status_code: 200, path: '/a', latency_ms: 10 }));
      await storage.save(createRecord({ method: 'GET', status_code: 200, path: '/a', latency_ms: 20 }));
      await storage.save(createRecord({ method: 'POST', status_code: 500, path: '/b', latency_ms: 100 }));
    });

    it('should return correct total', async () => {
      const metrics = await storage.getMetrics();
      expect(metrics.requests.total).toBe(3);
    });

    it('should return by_method counts', async () => {
      const metrics = await storage.getMetrics();
      expect(metrics.requests.by_method.GET).toBe(2);
      expect(metrics.requests.by_method.POST).toBe(1);
    });

    it('should return latency stats', async () => {
      const metrics = await storage.getMetrics();
      expect(metrics.performance.min).toBe(10);
      expect(metrics.performance.max).toBe(100);
    });

    it('should return system info', async () => {
      const metrics = await storage.getMetrics();
      expect(metrics.system.storage_strategy).toBe('sqlite');
    });
  });

  // ─── Manual logs ─────────────────────────────────────────────────

  describe('saveLog() / findLogs()', () => {
    it('should save and retrieve a log', async () => {
      await storage.saveLog({
        id: 'log-1',
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: 'Test log message'
      });

      const result = await storage.findLogs();
      expect(result.data.length).toBe(1);
      expect(result.data[0].message).toBe('Test log message');
    });

    it('should filter by level', async () => {
      await storage.saveLog({ id: 'l1', timestamp: new Date().toISOString(), level: 'INFO', message: 'Info' });
      await storage.saveLog({ id: 'l2', timestamp: new Date().toISOString(), level: 'ERROR', message: 'Error' });

      const result = await storage.findLogs({ level: 'ERROR' });
      expect(result.data.length).toBe(1);
    });
  });

  // ─── cleanup() ───────────────────────────────────────────────────

  describe('cleanup()', () => {
    it('should remove old records', async () => {
      const oldTs = new Date(Date.now() - 10 * 86400000).toISOString(); // 10 days ago
      await storage.save(createRecord({ request_id: 'old', timestamp: oldTs }));
      await storage.save(createRecord({ request_id: 'new', timestamp: new Date().toISOString() }));

      const removed = await storage.cleanup({ older_than_days: 7 });
      expect(removed).toBeGreaterThanOrEqual(1);
      expect(await storage.findById('old')).toBeNull();
      expect(await storage.findById('new')).not.toBeNull();
    });
  });

  // ─── close() ─────────────────────────────────────────────────────

  describe('close()', () => {
    it('should close the database connection', async () => {
      await storage.close();
      expect(storage.db).toBeNull();
    });
  });
});
