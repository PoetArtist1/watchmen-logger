/**
 * @file Unit tests for MemoryStorage
 * Tests circular buffer, FIFO eviction, filtering, cursor pagination,
 * metrics calculation, cleanup, and manual logs.
 */


const MemoryStorage = require('../../../src/storage/MemoryStorage');

/**
 * Helper to create a sample request record.
 * @param {object} [overrides] - Fields to override
 * @returns {object}
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

describe('MemoryStorage', () => {
  let storage;

  beforeEach(async () => {
    storage = new MemoryStorage({
      max_records: 100,
      cleanup_enabled: false // disable timer in tests
    });
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
  });

  // ─── Initialization ──────────────────────────────────────────────

  describe('initialize()', () => {
    it('should initialize without errors', async () => {
      const s = new MemoryStorage();
      await expect(s.initialize()).resolves.toBeUndefined();
      await s.close();
    });

    it('should start cleanup timer when enabled', async () => {
      const s = new MemoryStorage({ cleanup_enabled: true, cleanup_interval_minutes: 1 });
      await s.initialize();
      expect(s._cleanupTimer).not.toBeNull();
      await s.close();
    });
  });

  // ─── save() ──────────────────────────────────────────────────────

  describe('save()', () => {
    it('should save a record', async () => {
      const record = createRecord({ request_id: 'test-id-1' });
      await storage.save(record);

      const found = await storage.findById('test-id-1');
      expect(found).not.toBeNull();
      expect(found.request_id).toBe('test-id-1');
      expect(found.method).toBe('GET');
    });

    it('should throw if record has no request_id', async () => {
      await expect(storage.save({})).rejects.toThrow('request_id');
    });

    it('should throw if record is null', async () => {
      await expect(storage.save(null)).rejects.toThrow();
    });

    it('should add created_at timestamp', async () => {
      const record = createRecord({ request_id: 'ts-test' });
      await storage.save(record);

      const found = await storage.findById('ts-test');
      expect(found.created_at).toBeDefined();
    });
  });

  // ─── Circular buffer / FIFO ──────────────────────────────────────

  describe('FIFO eviction', () => {
    it('should evict oldest record when at capacity', async () => {
      const small = new MemoryStorage({ max_records: 3, cleanup_enabled: false });
      await small.initialize();

      await small.save(createRecord({ request_id: 'first' }));
      await small.save(createRecord({ request_id: 'second' }));
      await small.save(createRecord({ request_id: 'third' }));
      await small.save(createRecord({ request_id: 'fourth' }));

      // 'first' should have been evicted
      expect(await small.findById('first')).toBeNull();
      expect(await small.findById('second')).not.toBeNull();
      expect(await small.findById('fourth')).not.toBeNull();

      await small.close();
    });

    it('should maintain exactly max_records', async () => {
      const small = new MemoryStorage({ max_records: 5, cleanup_enabled: false });
      await small.initialize();

      for (let i = 0; i < 10; i++) {
        await small.save(createRecord({ request_id: `r-${i}` }));
      }

      const result = await small.findAll();
      expect(result.data.length).toBe(5);

      await small.close();
    });
  });

  // ─── findById() ──────────────────────────────────────────────────

  describe('findById()', () => {
    it('should return null for non-existent ID', async () => {
      expect(await storage.findById('non-existent')).toBeNull();
    });

    it('should return the correct record', async () => {
      await storage.save(createRecord({ request_id: 'find-me', path: '/special' }));
      const found = await storage.findById('find-me');
      expect(found.path).toBe('/special');
    });
  });

  // ─── findAll() with filters ──────────────────────────────────────

  describe('findAll() - filtering', () => {
    beforeEach(async () => {
      await storage.save(createRecord({ request_id: 'r1', method: 'GET', status_code: 200, path: '/api/users', latency_ms: 10 }));
      await storage.save(createRecord({ request_id: 'r2', method: 'POST', status_code: 201, path: '/api/users', latency_ms: 50 }));
      await storage.save(createRecord({ request_id: 'r3', method: 'GET', status_code: 404, path: '/api/products', latency_ms: 5 }));
      await storage.save(createRecord({ request_id: 'r4', method: 'DELETE', status_code: 500, path: '/api/users/1', latency_ms: 200, error_message: 'Internal error' }));
    });

    it('should filter by method', async () => {
      const result = await storage.findAll({ method: 'GET' });
      expect(result.data.length).toBe(2);
      expect(result.data.every(r => r.method === 'GET')).toBe(true);
    });

    it('should filter by multiple methods', async () => {
      const result = await storage.findAll({ method: ['GET', 'POST'] });
      expect(result.data.length).toBe(3);
    });

    it('should filter by status_code', async () => {
      const result = await storage.findAll({ status_code: 200 });
      expect(result.data.length).toBe(1);
    });

    it('should filter by path (partial match)', async () => {
      const result = await storage.findAll({ path: 'products' });
      expect(result.data.length).toBe(1);
      expect(result.data[0].path).toBe('/api/products');
    });

    it('should filter by has_error', async () => {
      const result = await storage.findAll({ has_error: true });
      expect(result.data.length).toBe(2); // 404 + 500
      expect(result.data.every(r => r.status_code >= 400)).toBe(true);
    });

    it('should filter by latency range', async () => {
      const result = await storage.findAll({ min_latency: 10, max_latency: 100 });
      expect(result.data.length).toBe(2); // latency 10 and 50
    });

    it('should filter by search term', async () => {
      const result = await storage.findAll({ search: 'r1' });
      expect(result.data.length).toBe(1);
    });

    it('should return total_count correctly', async () => {
      const result = await storage.findAll();
      expect(result.pagination.total_count).toBe(4);
    });
  });

  // ─── findAll() - pagination ──────────────────────────────────────

  describe('findAll() - cursor pagination', () => {
    beforeEach(async () => {
      for (let i = 0; i < 10; i++) {
        const ts = new Date(Date.now() + i * 1000).toISOString();
        await storage.save(createRecord({ request_id: `page-${i}`, timestamp: ts }));
      }
    });

    it('should respect limit', async () => {
      const result = await storage.findAll({}, { limit: 3 });
      expect(result.data.length).toBe(3);
      expect(result.pagination.has_more).toBe(true);
    });

    it('should paginate with cursor', async () => {
      const page1 = await storage.findAll({}, { limit: 3 });
      expect(page1.data.length).toBe(3);
      expect(page1.pagination.next_cursor).not.toBeNull();

      const page2 = await storage.findAll({}, { limit: 3, cursor: page1.pagination.next_cursor });
      expect(page2.data.length).toBe(3);

      // Pages should not overlap
      const page1Ids = page1.data.map(r => r.request_id);
      const page2Ids = page2.data.map(r => r.request_id);
      expect(page1Ids.some(id => page2Ids.includes(id))).toBe(false);
    });

    it('should cap limit at 200', async () => {
      const result = await storage.findAll({}, { limit: 500 });
      // Should not exceed 200 even if requested
      expect(result.data.length).toBeLessThanOrEqual(200);
    });

    it('should order desc by default', async () => {
      const result = await storage.findAll({}, { limit: 5 });
      const timestamps = result.data.map(r => new Date(r.timestamp).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeLessThanOrEqual(timestamps[i - 1]);
      }
    });

    it('should support asc order', async () => {
      const result = await storage.findAll({}, { limit: 5, order: 'asc' });
      const timestamps = result.data.map(r => new Date(r.timestamp).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });
  });

  // ─── getMetrics() ────────────────────────────────────────────────

  describe('getMetrics()', () => {
    beforeEach(async () => {
      await storage.save(createRecord({ method: 'GET', status_code: 200, path: '/api/a', latency_ms: 10 }));
      await storage.save(createRecord({ method: 'GET', status_code: 200, path: '/api/a', latency_ms: 20 }));
      await storage.save(createRecord({ method: 'POST', status_code: 201, path: '/api/b', latency_ms: 30 }));
      await storage.save(createRecord({ method: 'GET', status_code: 404, path: '/api/c', latency_ms: 5, error_message: 'Not found' }));
      await storage.save(createRecord({ method: 'POST', status_code: 500, path: '/api/b', latency_ms: 100, error_message: 'Server error' }));
    });

    it('should return correct total', async () => {
      const metrics = await storage.getMetrics();
      expect(metrics.requests.total).toBe(5);
    });

    it('should group by method', async () => {
      const metrics = await storage.getMetrics();
      expect(metrics.requests.by_method.GET).toBe(3);
      expect(metrics.requests.by_method.POST).toBe(2);
    });

    it('should group by status', async () => {
      const metrics = await storage.getMetrics();
      expect(metrics.requests.by_status['2xx']).toBe(3);
      expect(metrics.requests.by_status['4xx']).toBe(1);
      expect(metrics.requests.by_status['5xx']).toBe(1);
    });

    it('should calculate latency stats', async () => {
      const metrics = await storage.getMetrics();
      expect(metrics.performance.min).toBe(5);
      expect(metrics.performance.max).toBe(100);
      expect(metrics.performance.avg).toBeGreaterThan(0);
    });

    it('should return top endpoints', async () => {
      const metrics = await storage.getMetrics();
      expect(metrics.top_endpoints.length).toBeGreaterThan(0);
      expect(metrics.top_endpoints[0].path).toBe('/api/a');
      expect(metrics.top_endpoints[0].count).toBe(2);
    });

    it('should return error counts', async () => {
      const metrics = await storage.getMetrics();
      expect(metrics.errors.total_4xx).toBe(1);
      expect(metrics.errors.total_5xx).toBe(1);
    });

    it('should include system info', async () => {
      const metrics = await storage.getMetrics();
      expect(metrics.system.storage_strategy).toBe('memory');
      expect(metrics.system.uptime_seconds).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── Manual logs ─────────────────────────────────────────────────

  describe('saveLog() / findLogs()', () => {
    it('should save and retrieve a log entry', async () => {
      await storage.saveLog({
        id: 'log-1',
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        message: 'Something went wrong'
      });

      const result = await storage.findLogs();
      expect(result.data.length).toBe(1);
      expect(result.data[0].level).toBe('ERROR');
    });

    it('should throw if log entry has no id', async () => {
      await expect(storage.saveLog({})).rejects.toThrow('id');
    });

    it('should filter logs by level', async () => {
      await storage.saveLog({ id: 'l1', timestamp: new Date().toISOString(), level: 'INFO', message: 'Info msg' });
      await storage.saveLog({ id: 'l2', timestamp: new Date().toISOString(), level: 'ERROR', message: 'Error msg' });

      const result = await storage.findLogs({ level: 'INFO' });
      expect(result.data.length).toBe(1);
      expect(result.data[0].level).toBe('INFO');
    });

    it('should search logs by message', async () => {
      await storage.saveLog({ id: 'l1', timestamp: new Date().toISOString(), level: 'INFO', message: 'Database connected' });
      await storage.saveLog({ id: 'l2', timestamp: new Date().toISOString(), level: 'ERROR', message: 'Timeout error' });

      const result = await storage.findLogs({ search: 'database' });
      expect(result.data.length).toBe(1);
    });
  });

  // ─── cleanup() ───────────────────────────────────────────────────

  describe('cleanup()', () => {
    it('should remove old records', async () => {
      const oldTimestamp = new Date(Date.now() - 48 * 3600000).toISOString(); // 48 hours ago
      const newTimestamp = new Date().toISOString();

      await storage.save(createRecord({ request_id: 'old', timestamp: oldTimestamp }));
      await storage.save(createRecord({ request_id: 'new', timestamp: newTimestamp }));

      const removed = await storage.cleanup({ older_than_hours: 24 });
      expect(removed).toBeGreaterThanOrEqual(1);
      expect(await storage.findById('old')).toBeNull();
      expect(await storage.findById('new')).not.toBeNull();
    });
  });

  // ─── close() ─────────────────────────────────────────────────────

  describe('close()', () => {
    it('should clear all data', async () => {
      await storage.save(createRecord());
      await storage.close();
      // Internal arrays should be cleared
      expect(storage._records.length).toBe(0);
      expect(storage._logs.length).toBe(0);
    });
  });

  // ─── Deprecated store() ──────────────────────────────────────────

  describe('store() [deprecated]', () => {
    it('should still work and delegate to save()', async () => {
      const record = createRecord({ request_id: 'deprecated-test' });
      await storage.store(record);

      const found = await storage.findById('deprecated-test');
      expect(found).not.toBeNull();
    });
  });
});
