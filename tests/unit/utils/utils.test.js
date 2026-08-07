/**
 * Unit tests for utils (uuid, dates, mask).
 */

const {
  generateUuid,
  nowISO8601,
  toISO8601,
  isISO8601,
  maskHeaders,
  maskSensitiveData,
  REDACTED
} = require('../../../src/utils');

describe('utils/uuid', () => {
  it('generates a valid UUID v4', () => {
    const id = generateUuid();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('generates unique values', () => {
    const a = generateUuid();
    const b = generateUuid();
    expect(a).not.toBe(b);
  });
});

describe('utils/dates', () => {
  it('nowISO8601 returns an ISO string', () => {
    const value = nowISO8601();
    expect(isISO8601(value)).toBe(true);
    expect(Date.parse(value)).not.toBeNaN();
  });

  it('toISO8601 formats Date and timestamps', () => {
    const date = new Date('2026-07-29T12:00:00.000Z');
    expect(toISO8601(date)).toBe('2026-07-29T12:00:00.000Z');
    expect(toISO8601(date.getTime())).toBe('2026-07-29T12:00:00.000Z');
    expect(toISO8601('2026-07-29T12:00:00.000Z')).toBe('2026-07-29T12:00:00.000Z');
  });

  it('toISO8601 throws on invalid input', () => {
    expect(() => toISO8601('not-a-date')).toThrow(TypeError);
  });

  it('isISO8601 rejects non-ISO values', () => {
    expect(isISO8601('')).toBe(false);
    expect(isISO8601('2026-07-29')).toBe(false);
    expect(isISO8601(null)).toBe(false);
  });
});

describe('utils/mask', () => {
  it('masks sensitive headers case-insensitively', () => {
    const masked = maskHeaders({
      Authorization: 'Bearer secret',
      Cookie: 'session=abc',
      'Content-Type': 'application/json'
    });

    expect(masked.Authorization).toBe(REDACTED);
    expect(masked.Cookie).toBe(REDACTED);
    expect(masked['Content-Type']).toBe('application/json');
  });

  it('returns empty object for invalid headers input', () => {
    expect(maskHeaders(null)).toEqual({});
    expect(maskHeaders(undefined)).toEqual({});
  });

  it('masks passwords and cookies in nested objects', () => {
    const masked = maskSensitiveData({
      user: 'alice',
      password: 'super-secret',
      nested: { token: 'xyz', ok: true },
      cookie: 'sid=1'
    });

    expect(masked.user).toBe('alice');
    expect(masked.password).toBe(REDACTED);
    expect(masked.nested.token).toBe(REDACTED);
    expect(masked.nested.ok).toBe(true);
    expect(masked.cookie).toBe(REDACTED);
  });

  it('masks items inside arrays', () => {
    const masked = maskSensitiveData([{ password: 'a' }, { name: 'b' }]);
    expect(masked[0].password).toBe(REDACTED);
    expect(masked[1].name).toBe('b');
  });

  it('accepts extra sensitive keys', () => {
    const masked = maskSensitiveData(
      { customSecret: 'nope', visible: 1 },
      { sensitiveKeys: ['customSecret'] }
    );
    expect(masked.customSecret).toBe(REDACTED);
    expect(masked.visible).toBe(1);
  });
});
