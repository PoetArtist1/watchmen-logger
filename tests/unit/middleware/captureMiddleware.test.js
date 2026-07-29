/**
 * @file Unit tests for captureMiddleware
 * Tests request/response data capture, excluded paths, sensitive header masking,
 * and non-blocking async behavior.
 */


const createCaptureMiddleware = require('../../../src/middleware/captureMiddleware');

/**
 * Creates a mock Express request object.
 */
function createMockReq(overrides = {}) {
  return {
    method: overrides.method || 'GET',
    path: overrides.path || '/api/test',
    originalUrl: overrides.originalUrl || '/api/test?page=1',
    protocol: 'http',
    ip: '127.0.0.1',
    get: (header) => {
      const headers = {
        host: 'localhost:3000',
        'user-agent': 'test-agent',
        ...(overrides.headerValues || {})
      };
      return headers[header.toLowerCase()];
    },
    headers: {
      'content-type': 'application/json',
      host: 'localhost:3000',
      'user-agent': 'test-agent',
      ...(overrides.headers || {})
    },
    query: overrides.query || { page: '1' },
    body: overrides.body || null,
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides
  };
}

/**
 * Creates a mock Express response object.
 */
function createMockRes() {
  const headers = {};
  const res = {
    statusCode: 200,
    statusMessage: 'OK',
    _headers: headers,
    getHeaders: () => ({ ...headers }),
    getHeader: (name) => headers[name.toLowerCase()],
    setHeader: (name, value) => { headers[name.toLowerCase()] = value; },
    write: vi.fn(function (chunk, encoding, callback) {
      if (typeof encoding === 'function') callback = encoding;
      if (callback) callback();
      return true;
    }),
    end: vi.fn(function (chunk, encoding, callback) {
      if (typeof encoding === 'function') callback = encoding;
      if (callback) callback();
    }),
    on: vi.fn()
  };
  return res;
}

describe('captureMiddleware', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = {
      save: vi.fn().mockResolvedValue(undefined)
    };
  });

  // ─── Basic capture ───────────────────────────────────────────────

  describe('basic capture', () => {
    it('should call next() to continue the middleware chain', () => {
      const middleware = createCaptureMiddleware(mockStorage);
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should attach request_id to the request object', () => {
      const middleware = createCaptureMiddleware(mockStorage);
      const req = createMockReq();
      const res = createMockRes();

      middleware(req, res, () => {});
      expect(req.requestId).toBeDefined();
      expect(req.requestId.length).toBe(36); // UUID v4 format
    });

    it('should capture data when res.end() is called', async () => {
      const middleware = createCaptureMiddleware(mockStorage);
      const req = createMockReq();
      const res = createMockRes();

      middleware(req, res, () => {});
      res.statusCode = 200;
      res.end('{"result":"ok"}');

      // Wait for setImmediate to fire
      await new Promise(resolve => setImmediate(resolve));

      expect(mockStorage.save).toHaveBeenCalled();
      const savedRecord = mockStorage.save.mock.calls[0][0];
      expect(savedRecord.method).toBe('GET');
      expect(savedRecord.path).toBe('/api/test');
      expect(savedRecord.status_code).toBe(200);
      expect(savedRecord.request_id).toBeDefined();
      expect(savedRecord.timestamp).toBeDefined();
      expect(savedRecord.latency_ms).toBeGreaterThanOrEqual(0);
    });

    it('should capture client_ip', async () => {
      const middleware = createCaptureMiddleware(mockStorage);
      const req = createMockReq();
      const res = createMockRes();

      middleware(req, res, () => {});
      res.end();

      await new Promise(resolve => setImmediate(resolve));

      const record = mockStorage.save.mock.calls[0][0];
      expect(record.client_ip).toBe('127.0.0.1');
    });

    it('should capture full_url', async () => {
      const middleware = createCaptureMiddleware(mockStorage);
      const req = createMockReq();
      const res = createMockRes();

      middleware(req, res, () => {});
      res.end();

      await new Promise(resolve => setImmediate(resolve));

      const record = mockStorage.save.mock.calls[0][0];
      expect(record.full_url).toContain('localhost:3000');
      expect(record.full_url).toContain('/api/test');
    });
  });

  // ─── Excluded paths ──────────────────────────────────────────────

  describe('excluded paths', () => {
    it('should skip excluded paths', () => {
      const middleware = createCaptureMiddleware(mockStorage, {
        excluded_paths: ['/health']
      });
      const req = createMockReq({ path: '/health' });
      const res = createMockRes();
      const next = vi.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalled();

      res.end();
      // save should not be called for excluded paths
    });

    it('should skip excluded paths with wildcard prefix', async () => {
      const middleware = createCaptureMiddleware(mockStorage, {
        excluded_paths: ['/api/monitoring*']
      });
      const req = createMockReq({ path: '/api/monitoring/metrics' });
      const res = createMockRes();

      middleware(req, res, () => {});
      res.end();

      await new Promise(resolve => setImmediate(resolve));
      expect(mockStorage.save).not.toHaveBeenCalled();
    });

    it('should capture non-excluded paths', async () => {
      const middleware = createCaptureMiddleware(mockStorage, {
        excluded_paths: ['/health']
      });
      const req = createMockReq({ path: '/api/users' });
      const res = createMockRes();

      middleware(req, res, () => {});
      res.end();

      await new Promise(resolve => setImmediate(resolve));
      expect(mockStorage.save).toHaveBeenCalled();
    });
  });

  // ─── Excluded methods ────────────────────────────────────────────

  describe('excluded methods', () => {
    it('should skip excluded methods', async () => {
      const middleware = createCaptureMiddleware(mockStorage, {
        excluded_methods: ['OPTIONS']
      });
      const req = createMockReq({ method: 'OPTIONS' });
      const res = createMockRes();

      middleware(req, res, () => {});
      res.end();

      await new Promise(resolve => setImmediate(resolve));
      expect(mockStorage.save).not.toHaveBeenCalled();
    });
  });

  // ─── Sensitive headers ───────────────────────────────────────────

  describe('sensitive header masking', () => {
    it('should mask authorization header by default', async () => {
      const middleware = createCaptureMiddleware(mockStorage);
      const req = createMockReq({
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer secret-token',
          host: 'localhost:3000',
          'user-agent': 'test-agent'
        }
      });
      const res = createMockRes();

      middleware(req, res, () => {});
      res.end();

      await new Promise(resolve => setImmediate(resolve));

      const record = mockStorage.save.mock.calls[0][0];
      expect(record.request_headers.authorization).toBe('[REDACTED]');
      expect(record.request_headers['content-type']).toBe('application/json');
    });

    it('should mask cookie header by default', async () => {
      const middleware = createCaptureMiddleware(mockStorage);
      const req = createMockReq({
        headers: {
          'content-type': 'application/json',
          cookie: 'session=abc123',
          host: 'localhost:3000',
          'user-agent': 'test-agent'
        }
      });
      const res = createMockRes();

      middleware(req, res, () => {});
      res.end();

      await new Promise(resolve => setImmediate(resolve));

      const record = mockStorage.save.mock.calls[0][0];
      expect(record.request_headers.cookie).toBe('[REDACTED]');
    });

    it('should not mask when mask_sensitive_data is false', async () => {
      const middleware = createCaptureMiddleware(mockStorage, {
        mask_sensitive_data: false
      });
      const req = createMockReq({
        headers: {
          authorization: 'Bearer token',
          host: 'localhost:3000',
          'user-agent': 'test-agent'
        }
      });
      const res = createMockRes();

      middleware(req, res, () => {});
      res.end();

      await new Promise(resolve => setImmediate(resolve));

      const record = mockStorage.save.mock.calls[0][0];
      expect(record.request_headers.authorization).toBe('Bearer token');
    });
  });

  // ─── Error capture ───────────────────────────────────────────────

  describe('error capture', () => {
    it('should capture error_message for 4xx status codes', async () => {
      const middleware = createCaptureMiddleware(mockStorage);
      const req = createMockReq();
      const res = createMockRes();

      middleware(req, res, () => {});
      res.statusCode = 404;
      res.statusMessage = 'Not Found';
      res.end();

      await new Promise(resolve => setImmediate(resolve));

      const record = mockStorage.save.mock.calls[0][0];
      expect(record.error_message).toBeTruthy();
      expect(record.status_code).toBe(404);
    });

    it('should set error_message to null for 2xx', async () => {
      const middleware = createCaptureMiddleware(mockStorage);
      const req = createMockReq();
      const res = createMockRes();

      middleware(req, res, () => {});
      res.statusCode = 200;
      res.end();

      await new Promise(resolve => setImmediate(resolve));

      const record = mockStorage.save.mock.calls[0][0];
      expect(record.error_message).toBeNull();
    });
  });

  // ─── Query params ────────────────────────────────────────────────

  describe('query parameters', () => {
    it('should capture query parameters', async () => {
      const middleware = createCaptureMiddleware(mockStorage);
      const req = createMockReq({ query: { page: '2', limit: '10' } });
      const res = createMockRes();

      middleware(req, res, () => {});
      res.end();

      await new Promise(resolve => setImmediate(resolve));

      const record = mockStorage.save.mock.calls[0][0];
      expect(record.request_query).toEqual({ page: '2', limit: '10' });
    });

    it('should set query to null when empty', async () => {
      const middleware = createCaptureMiddleware(mockStorage);
      const req = createMockReq({ query: {} });
      const res = createMockRes();

      middleware(req, res, () => {});
      res.end();

      await new Promise(resolve => setImmediate(resolve));

      const record = mockStorage.save.mock.calls[0][0];
      expect(record.request_query).toBeNull();
    });
  });

  // ─── Non-blocking ────────────────────────────────────────────────

  describe('non-blocking behavior', () => {
    it('should not throw if storage.save fails', async () => {
      mockStorage.save = vi.fn().mockRejectedValue(new Error('DB error'));
      const middleware = createCaptureMiddleware(mockStorage);
      const req = createMockReq();
      const res = createMockRes();

      middleware(req, res, () => {});

      // This should not throw
      expect(() => res.end()).not.toThrow();

      await new Promise(resolve => setImmediate(resolve));
      // save was called but failed silently
      expect(mockStorage.save).toHaveBeenCalled();
    });
  });

  // ─── Configurable capture ────────────────────────────────────────

  describe('configurable capture', () => {
    it('should not capture request_headers when disabled', async () => {
      const middleware = createCaptureMiddleware(mockStorage, {
        request_headers: false
      });
      const req = createMockReq();
      const res = createMockRes();

      middleware(req, res, () => {});
      res.end();

      await new Promise(resolve => setImmediate(resolve));

      const record = mockStorage.save.mock.calls[0][0];
      expect(record.request_headers).toBeUndefined();
    });

    it('should not capture request_body when disabled', async () => {
      const middleware = createCaptureMiddleware(mockStorage, {
        request_body: false
      });
      const req = createMockReq({ body: { name: 'test' } });
      const res = createMockRes();

      middleware(req, res, () => {});
      res.end();

      await new Promise(resolve => setImmediate(resolve));

      const record = mockStorage.save.mock.calls[0][0];
      expect(record.request_body).toBeUndefined();
    });
  });
});
