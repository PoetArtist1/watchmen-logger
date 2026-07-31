/**
 * Unit tests for monitoring router (RF-03).
 */

const express = require('express');
const { MemoryStorage } = require('../../../src/storage');
const { createMonitoringRouter } = require('../../../src/monitoring');

async function withServer(storage, monitoringConfig, seed) {
  if (seed) await seed(storage);
  const app = express();
  app.use('/api/monitoring', createMonitoringRouter(storage, monitoringConfig));
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({
        base: `http://127.0.0.1:${port}/api/monitoring`,
        close: () => new Promise((r) => server.close(r))
      });
    });
  });
}

describe('monitoring router (RF-03)', () => {
  /** @type {MemoryStorage} */
  let storage;

  beforeEach(async () => {
    storage = new MemoryStorage({ cleanup_enabled: false });
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
  });

  it('serves SPA shell with base href', async () => {
    const { base, close } = await withServer(storage, {
      enabled: true,
      auth: { enabled: false }
    });
    const res = await fetch(`${base}/`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('watchmen');
    expect(html).toContain('<base href=');
    await close();
  });

  it('returns metrics JSON', async () => {
    const { base, close } = await withServer(storage, { auth: { enabled: false } }, async (s) => {
      await s.save({
        request_id: '11111111-1111-4111-8111-111111111111',
        timestamp: new Date().toISOString(),
        method: 'GET',
        path: '/api/users',
        full_url: 'http://localhost/api/users',
        status_code: 200,
        latency_ms: 12
      });
    });

    const res = await fetch(`${base}/metrics`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.requests.total).toBe(1);
    expect(data.timeline).toBeDefined();
    await close();
  });

  it('lists requests with cursor pagination', async () => {
    const { base, close } = await withServer(storage, {
      page_size: 2,
      max_page_size: 200,
      auth: { enabled: false }
    }, async (s) => {
      for (let i = 0; i < 3; i++) {
        await s.save({
          request_id: `11111111-1111-4111-8111-11111111111${i}`,
          timestamp: new Date(Date.now() - i * 1000).toISOString(),
          method: 'GET',
          path: `/api/item/${i}`,
          full_url: `http://localhost/api/item/${i}`,
          status_code: 200,
          latency_ms: 5 + i
        });
      }
    });

    const page1 = await (await fetch(`${base}/requests?limit=2`)).json();
    expect(page1.data).toHaveLength(2);
    expect(page1.pagination.has_more).toBe(true);
    expect(page1.pagination.next_cursor).toBeTruthy();

    const page2 = await (await fetch(
      `${base}/requests?limit=2&cursor=${encodeURIComponent(page1.pagination.next_cursor)}`
    )).json();
    expect(page2.data.length).toBeGreaterThanOrEqual(1);
    await close();
  });

  it('returns request detail by id', async () => {
    const id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const { base, close } = await withServer(storage, { auth: { enabled: false } }, async (s) => {
      await s.save({
        request_id: id,
        timestamp: new Date().toISOString(),
        method: 'POST',
        path: '/api/users',
        full_url: 'http://localhost/api/users',
        status_code: 201,
        latency_ms: 9,
        request_body: { name: 'Ada' }
      });
    });

    const res = await fetch(`${base}/requests/${id}`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.method).toBe('POST');
    expect(data.request_body).toEqual({ name: 'Ada' });
    await close();
  });

  it('requires auth for data endpoints when enabled', async () => {
    const { base, close } = await withServer(storage, {
      auth: {
        enabled: true,
        username: 'admin',
        password: 'secret',
        session_timeout_hours: 1
      }
    });

    const denied = await fetch(`${base}/metrics`);
    expect(denied.status).toBe(401);

    const login = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'secret' })
    });
    expect(login.status).toBe(200);
    const cookie = login.headers.get('set-cookie');
    expect(cookie).toContain('wm_monitor_session');

    const ok = await fetch(`${base}/metrics`, {
      headers: { Cookie: cookie.split(';')[0] }
    });
    expect(ok.status).toBe(200);
    await close();
  });
});
