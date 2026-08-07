# 🏗️ Arquitectura de Software — watchmen-logger

Este documento describe la arquitectura técnica, los patrones de diseño y las decisiones de implementación del componente **watchmen-logger**.

---

## 1. Visión General del Sistema

`watchmen-logger` es un middleware de observabilidad y logging autocontenido para APIs REST desarrolladas en Node.js (Express/Fastify). Su objetivo principal es interceptar, registrar y analizar automáticamente las peticiones y respuestas HTTP con un impacto imperceptible en la latencia de la aplicación (< 5ms de overhead).

```
   +--------------------------------------------------------+
   |                  Aplicación Express                    |
   |                                                        |
   |   [ Request HTTP ] ---> ( captureMiddleware )          |
   |                                  |                     |
   |                                  v (Medición hrtime)   |
   |                           [ Next Handler ]             |
   |                                  |                     |
   |                                  v                     |
   |   [ Response HTTP ] <-- ( Intercepta res.end )         |
   +----------------------------------|---------------------+
                                      | (setImmediate - Asíncrono)
                                      v
                         +--------------------------+
                         |     StorageFactory       |
                         +--------------------------+
                                      |
         +----------------------------+----------------------------+
         |                            |                            |
         v                            v                            v
+------------------+         +------------------+         +------------------+
|  MemoryStorage   |         |  SqliteStorage   |         | PostgresStorage  |
| (Buffer Circular)|         |   (better-sqlite)|         |    (pg Pool)     |
+------------------+         +------------------+         +------------------+
```

---

## 2. Patrones de Diseño Aplicados

### A. Patrón Strategy (Estrategia)
Ubicación: `src/storage/StorageStrategy.js` y sus subclases.

- **Propósito:** Permitir intercambiar el motor de almacenamiento de logs (Memoria RAM, SQLite o PostgreSQL) sin modificar el middleware ni el código de la aplicación cliente.
- **Estructura:**
  - `StorageStrategy` (Clase base abstracta): Define la interfaz estándar (`save()`, `saveLog()`, `findAll()`, `findById()`, `getMetrics()`, `findLogs()`, `cleanup()`, `close()`).
  - `MemoryStorage`: Implementación con buffer circular FIFO.
  - `SqliteStorage`: Implementación embebida persistente en disco.
  - `PostgresStorage`: Implementación empresarial cliente-servidor con Pool de conexiones.

### B. Patrón Factory (Fábrica)
Ubicación: `src/storage/StorageFactory.js`

- **Propósito:** Encapsular la lógica de creación e instanciación de las estrategias de almacenamiento a partir de un objeto de configuración dinámico (ej. `logger.config.json`).
- **Uso:** `StorageFactory.create({ strategy: 'sqlite', config: { database_path: '...' } })`.

### C. Patrón Middleware (Interceptor Asíncrono)
Ubicación: `src/middleware/captureMiddleware.js`

- **Propósito:** Interceptar el flujo HTTP de Express sin bloquear el Event Loop de Node.js.
- **Mecanismo:**
  1. Sobrescribe de forma segura el método `res.end` del objeto de respuesta de Express.
  2. Mide la latencia exacta usando `process.hrtime.bigint()` (precisión de nanosegundos).
  3. Ejecuta la respuesta HTTP original hacia el usuario inmediatamente.
  4. Encola la persistencia del registro en la base de datos a través de `setImmediate()`, evitando cualquier impacto de I/O en la respuesta HTTP.

### D. Patrón Migration Runner
Ubicación: `src/migrations/MigrationRunner.js`

- **Propósito:** Garantizar que las tablas `requests` y `manual_logs` e índices requeridos se creen automáticamente en SQLite/PostgreSQL antes de que la aplicación empiece a recibir peticiones.

### E. Configuración y Bootstrap
Ubicación: `src/config/` y `src/Logger.js`

- **Propósito:** Cargar `logger.config.json`, inyectar secretos desde `.env` (`${VAR_NAME}`), validar tipos al arranque y exponer la API pública `createLogger()` con `logInfo` / `logWarning` / `logError` / `logDebug`.
- **Prioridad de secretos:** variables del sistema > archivo `.env` > defaults del JSON.
- **Utilidades compartidas:** `src/utils/` (UUID v4, ISO 8601, masking de passwords/cookies/headers).
- **Montaje Express:** `logger.attach(app)` registra captura + router de monitoreo; `logger.monitoring()` expone solo la UI/API del RF-03.

### F. Monitoring UI (Signal Desk) — RF-03
Ubicación: `src/monitoring/`

- **Propósito:** Exponer una SPA embebida y APIs JSON para visualizar requests capturadas y métricas agregadas, sin build process y con peso objetivo &lt; 500KB (CDN para Chart.js / fuentes).
- **Router:** `createMonitoringRouter(storage, monitoringConfig)` monta:
  - `GET /` → shell HTML con `<base href>` inyectado
  - `GET /metrics` → métricas (+ cache TTL opcional)
  - `GET /requests` → lista con filtros y paginación por cursor
  - `GET /requests/:id` → detalle
  - `POST /auth/login|logout`, `GET /auth/me` → sesión cookie HMAC si `auth.enabled`
  - `GET /assets/*` → CSS/JS de la SPA
- **UI:** componentes Vanilla ES modules bajo `src/monitoring/ui/js/components/` (shell, dashboard, requestList, requestDetail, login, charts) y estilos en `ui/css/`.
- **Aislamiento:** `logger.middleware()` excluye automáticamente el prefijo del endpoint de monitoring (`/api/monitoring*`) para no auto-loguear la UI.

```
   [ Browser ] ──GET /api/monitoring/──► createMonitoringRouter
                        │
                        ├── /assets/*  (SPA estática)
                        ├── /metrics   ──► storage.getMetrics() (+ enrich timeline)
                        ├── /requests  ──► storage.findAll(filters, cursor)
                        └── /requests/:id ► storage.findById(id)
```

---

## 3. Modelo de Datos y Esquema

El almacenamiento se organiza en dos entidades principales:

### Tabla `requests`
Almacena la captura automática de tráfico HTTP.

| Campo | Tipo SQL | Descripción |
|-------|----------|-------------|
| `request_id` | `VARCHAR(36)` / `UUID` | Identificador único UUID v4 (Primary Key) |
| `timestamp` | `TIMESTAMP` / `TEXT` | Fecha en formato ISO 8601 |
| `method` | `VARCHAR(10)` | Método HTTP (GET, POST, PUT, DELETE, etc.) |
| `path` | `TEXT` | Ruta del endpoint interceptado |
| `full_url` | `TEXT` | URL completa incluyendo protocolo y host |
| `status_code` | `INTEGER` | Código de estado HTTP de respuesta |
| `latency_ms` | `INTEGER` | Tiempo de procesamiento en milisegundos |
| `client_ip` | `VARCHAR(45)` | IP del cliente (soporta IPv4 e IPv6) |
| `user_agent` | `TEXT` | User Agent del cliente |
| `request_headers` | `JSON` / `TEXT` | Cabeceras enmascaradas |
| `request_query` | `JSON` / `TEXT` | Parámetros de consulta en URL |
| `request_body` | `JSON` / `TEXT` | Cuerpo de la petición (truncado si excede límite) |
| `response_headers` | `JSON` / `TEXT` | Cabeceras de respuesta |
| `response_body` | `JSON` / `TEXT` | Cuerpo de respuesta (opcional) |
| `response_size_bytes` | `INTEGER` | Tamaño total enviado en bytes |
| `error_message` | `TEXT` | Mensaje de error para estados >= 400 |
| `stack_trace` | `TEXT` | Traza del error para respuestas 5xx |

### Tabla `manual_logs`
Almacena los eventos generados manualmente por el desarrollador (`logInfo`, `logError`, etc.).

---

## 4. Consideraciones de Rendimiento y Seguridad

1. **Enmascaramiento de Datos Sensibles (RF-02):**
   Las cabeceras configuradas en `sensitive_headers` (por defecto `authorization`, `cookie`, `set-cookie`) se reemplazan por `[REDACTED]` antes de ser guardadas.

2. **Límite de Tamaño de Body:**
   Para prevenir ataques de denegación de servicio por memoria (DoS), los cuerpos de peticiones/respuestas que excedan `max_body_size_kb` (por defecto 100KB) son reemplazados por un mensaje explicativo `[TRUNCATED: body exceeds limit]`.

3. **Optimización en SQLite:**
   Se utiliza el modo **WAL (Write-Ahead Logging)** y `PRAGMA synchronous = NORMAL` para maximizar la velocidad de escritura simultánea en disco.

4. **Optimización en PostgreSQL:**
   Se utiliza un **Pool de Conexiones** de `pg` y **Prepared Statements** parametrizados (`$1, $2...`) para evitar inyecciones SQL y reutilizar planes de ejecución.

---

## 5. Política de Deprecación (RF-09)

En cumplimiento con el requisito **RF-09** de evolución y madurez de código:

- En `v1.0.0`, el método `store()` fue marcado como **@deprecated** en favor de `save()`.
- Llama internamente a `save()` emitiendo una advertencia única `console.warn` por proceso.
- En `v1.0.0`, el método genérico `log(level, message)` de `WatchmenLogger` también está
  **@deprecated** en favor de `logInfo` / `logWarning` / `logError` / `logDebug`.
- Su eliminación definitiva está programada para la versión mayor **`v2.0.0`**.
- Los detalles completos se documentan en [`MIGRATION.md`](./MIGRATION.md).
