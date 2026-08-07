/**
 * Unit tests for config loading, env resolution and validation (RF-06).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  loadConfig,
  loadEnv,
  parseEnvContent,
  resolveEnvVars,
  validateConfig,
  DEFAULT_CONFIG
} = require('../../../src/config');

describe('config/parseEnvContent', () => {
  it('parses KEY=value, comments and quotes', () => {
    const parsed = parseEnvContent(`
# comment
FOO=bar
export BAR="baz qux"
EMPTY=
QUOTED='single'
`);
    expect(parsed.FOO).toBe('bar');
    expect(parsed.BAR).toBe('baz qux');
    expect(parsed.QUOTED).toBe('single');
    expect(parsed.EMPTY).toBe('');
  });
});

describe('config/loadEnv', () => {
  let tmpDir;
  let previous;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'watchmen-env-'));
    previous = { ...process.env };
  });

  afterEach(() => {
    process.env = previous;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads .env without overwriting existing system vars', () => {
    const envFile = path.join(tmpDir, '.env');
    fs.writeFileSync(envFile, 'WATCHMEN_TEST_A=from-file\nWATCHMEN_TEST_B=file-b\n');
    process.env.WATCHMEN_TEST_A = 'from-system';

    const loaded = loadEnv(envFile);
    expect(process.env.WATCHMEN_TEST_A).toBe('from-system');
    expect(process.env.WATCHMEN_TEST_B).toBe('file-b');
    expect(loaded.WATCHMEN_TEST_B).toBe('file-b');
    expect(loaded.WATCHMEN_TEST_A).toBeUndefined();
  });

  it('returns empty object when file is missing and not required', () => {
    expect(loadEnv(path.join(tmpDir, 'missing.env'))).toEqual({});
  });

  it('throws when required file is missing', () => {
    expect(() => loadEnv(path.join(tmpDir, 'missing.env'), { required: true }))
      .toThrow(/not found/);
  });
});

describe('config/resolveEnvVars', () => {
  beforeEach(() => {
    process.env.WATCHMEN_RESOLVE_HOST = 'db.internal';
    process.env.WATCHMEN_RESOLVE_USER = 'app';
  });

  afterEach(() => {
    delete process.env.WATCHMEN_RESOLVE_HOST;
    delete process.env.WATCHMEN_RESOLVE_USER;
  });

  it('resolves nested ${VAR} placeholders', () => {
    const resolved = resolveEnvVars({
      storage: {
        config: {
          host: '${WATCHMEN_RESOLVE_HOST}',
          user: '${WATCHMEN_RESOLVE_USER}',
          port: 5432
        }
      }
    });

    expect(resolved.storage.config.host).toBe('db.internal');
    expect(resolved.storage.config.user).toBe('app');
    expect(resolved.storage.config.port).toBe(5432);
  });

  it('fails fast when a variable is missing', () => {
    expect(() => resolveEnvVars({ password: '${WATCHMEN_MISSING_SECRET}' }))
      .toThrow(/Missing environment variable/);
  });
});

describe('config/validateConfig', () => {
  it('accepts a full default-like config', () => {
    const validated = validateConfig(structuredClone(DEFAULT_CONFIG));
    expect(validated.storage.strategy).toBe('memory');
    expect(validated.capture.mask_sensitive_data).toBe(true);
    expect(validated.monitoring.endpoint).toBe('/api/monitoring');
  });

  it('rejects invalid storage strategy', () => {
    const raw = structuredClone(DEFAULT_CONFIG);
    raw.storage.strategy = 'redis';
    expect(() => validateConfig(raw)).toThrow(/storage.strategy/);
  });

  it('requires auth credentials when auth is enabled', () => {
    const raw = structuredClone(DEFAULT_CONFIG);
    raw.monitoring.auth.enabled = true;
    raw.monitoring.auth.username = null;
    raw.monitoring.auth.password = null;
    expect(() => validateConfig(raw)).toThrow(/username/);
  });

  it('validates sqlite journal_mode enum', () => {
    const raw = structuredClone(DEFAULT_CONFIG);
    raw.storage.strategy = 'sqlite';
    raw.storage.config = { database_path: './logs/x.db', journal_mode: 'NOPE' };
    expect(() => validateConfig(raw)).toThrow(/journal_mode/);
  });

  it('applies sqlite defaults', () => {
    const raw = structuredClone(DEFAULT_CONFIG);
    raw.storage.strategy = 'sqlite';
    raw.storage.config = { database_path: './logs/x.db' };
    const validated = validateConfig(raw);
    expect(validated.storage.config.journal_mode).toBe('WAL');
    expect(validated.storage.config.auto_vacuum).toBe(true);
  });
});

describe('config/loadConfig', () => {
  let tmpDir;
  let previousEnv;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'watchmen-cfg-'));
    previousEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = previousEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('works with defaults when config file is absent (RF-01)', () => {
    const config = loadConfig({
      configPath: path.join(tmpDir, 'logger.config.json'),
      envPath: path.join(tmpDir, '.env'),
      loadDotEnv: true
    });
    expect(config.storage.strategy).toBe('memory');
    expect(config.capture.request_headers).toBe(true);
  });

  it('loads JSON, injects .env and resolves placeholders', () => {
    fs.writeFileSync(path.join(tmpDir, '.env'), 'WATCHMEN_CFG_PASS=s3cret\n');
    fs.writeFileSync(
      path.join(tmpDir, 'logger.config.json'),
      JSON.stringify({
        storage: {
          strategy: 'postgresql',
          config: {
            host: 'localhost',
            database: 'logs',
            user: 'app',
            password: '${WATCHMEN_CFG_PASS}',
            port: 5432
          }
        },
        capture: DEFAULT_CONFIG.capture,
        monitoring: DEFAULT_CONFIG.monitoring
      })
    );

    const config = loadConfig({
      configPath: path.join(tmpDir, 'logger.config.json'),
      envPath: path.join(tmpDir, '.env')
    });

    expect(config.storage.strategy).toBe('postgresql');
    expect(config.storage.config.password).toBe('s3cret');
  });

  it('throws on invalid JSON', () => {
    const cfgPath = path.join(tmpDir, 'logger.config.json');
    fs.writeFileSync(cfgPath, '{ broken');
    expect(() => loadConfig({
      configPath: cfgPath,
      envPath: path.join(tmpDir, '.env')
    })).toThrow(/Invalid JSON/);
  });
});
