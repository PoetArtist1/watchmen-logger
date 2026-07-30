# Migration Guide

This document describes breaking changes and deprecations in watchmen-logger,
along with instructions to migrate your code.

---

## v0.1.0 → v1.0.0 (planned)

### Deprecated: `store()` method → Use `save()` instead

**Status**: Deprecated in v0.1.0, scheduled for removal in v1.0.0.

**Reason**: The method was renamed from `store()` to `save()` for consistency
with common data persistence conventions (e.g., `Model.save()` in ORMs) and to
better express the intent of persisting a single record. The name `store` was
ambiguous — it could refer to the storage engine itself rather than the action
of persisting data.

#### Before (deprecated)

```javascript
const storage = StorageFactory.create({ strategy: 'memory' });
await storage.initialize();

// ⚠️ Deprecated — will emit a console.warn once per session
await storage.store({
  request_id: '550e8400-e29b-41d4-a716-446655440000',
  timestamp: new Date().toISOString(),
  method: 'GET',
  path: '/api/users',
  full_url: 'http://localhost:3000/api/users',
  status_code: 200,
  latency_ms: 12
});
```

#### After (recommended)

```javascript
const storage = StorageFactory.create({ strategy: 'memory' });
await storage.initialize();

// ✅ Use save() instead
await storage.save({
  request_id: '550e8400-e29b-41d4-a716-446655440000',
  timestamp: new Date().toISOString(),
  method: 'GET',
  path: '/api/users',
  full_url: 'http://localhost:3000/api/users',
  status_code: 200,
  latency_ms: 12
});
```

#### What happens if I keep using `store()`?

- **v0.1.0**: `store()` still works but emits a `console.warn()` the first time
  it is invoked in a session. The warning includes a link to this migration
  guide.
- **v1.0.0 (planned)**: `store()` will be **removed entirely**. Any code calling
  `store()` will throw a runtime error.

#### How to migrate

1. Find all calls to `storage.store(record)` in your codebase.
2. Replace them with `storage.save(record)`.
3. The method signature is identical — no other changes are needed.

```diff
- await storage.store(record);
+ await storage.save(record);
```

---

### Deprecated: `log(level, message)` → Use typed methods instead

**Status**: Deprecated in v0.1.0, scheduled for removal in v1.0.0.

**Reason**: Explicit methods (`logInfo`, `logWarning`, `logError`, `logDebug`) are
clearer at the call site and match RF-05. The generic `log()` helper remains only
for transitional compatibility.

#### Before (deprecated)

```javascript
await logger.log('info', 'Server started', { port: 3000 });
await logger.log('error', 'Payment failed', { orderId: 42 });
```

#### After (recommended)

```javascript
await logger.logInfo('Server started', { port: 3000 });
await logger.logError('Payment failed', null, { orderId: 42 });
```

#### What happens if I keep using `log()`?

- **v0.1.0**: Still works; emits a one-time `console.warn` per process.
- **v1.0.0 (planned)**: Removed.
