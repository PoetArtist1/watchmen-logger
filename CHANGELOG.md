# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-07

Primera versión pública completa (MAJOR inicial). Los siguientes releases serán
`1.x.y` (MINOR/PATCH) hasta el próximo breaking change (`2.0.0`).

### Added

- **Interface web de monitoreo (RF-03):** SPA embebida en `src/monitoring/ui`
  ("Signal Desk") con dashboard, lista filtrable, detalle y login; endpoints
  `/api/monitoring`, `/metrics`, `/requests`, `/requests/:id`; paginación por
  cursor; auth por cookie HMAC; `logger.monitoring()` / `logger.attach(app)` y
  demo `npm run demo` / `pnpm run demo`.
- **Configuración JSON + `.env` (RF-06):** Módulo `src/config/` que carga
  `logger.config.json`, inyecta secretos desde `.env`, resuelve placeholders
  `${VAR_NAME}` y valida tipos/enums/dependencias al arranque. Incluye
  `.env.example` y `logger.config.example.json`.
- **API de logging manual (RF-05):** `createLogger()` / `WatchmenLogger` con
  `logInfo`, `logWarning`, `logError` y `logDebug`, persistiendo en
  `manual_logs` vía `storage.saveLog()`.
- **Utilidades (RF-01):** Generación de UUID v4 (`crypto.randomUUID`),
  timestamps ISO 8601 y enmascaramiento de datos sensibles (passwords,
  cookies, headers).
- **Instalación base (RF-01):** Campo `files` en `package.json` para publicación
  limpia en NPM; defaults out-of-the-box cuando no existe config file
  (estrategia `memory` + SQLite embebido disponible).
- **Middleware de captura automática (RF-02):** Express middleware que intercepta
  requests y responses, capturando timestamp, método HTTP, URL completa, headers,
  query params, body, IP del cliente, puerto del cliente, user agent, status
  code, latencia, tamaño de respuesta, mensajes de error y stack traces.
- **Estrategias de almacenamiento (RF-04):** Memoria (buffer circular), SQLite
  (`better-sqlite3`, WAL) y PostgreSQL (`pg` pool).
- **Sistema de migraciones:** Runner `.sql` con tracking y rollback.
- **StorageFactory + StorageStrategy:** Strategy Pattern para intercambiar backends.
- **Paginación por cursor y filtros combinables** (método, status/grupos 2xx–5xx,
  path, fechas, latencia, `has_error`).
- **Métricas:** totales, tasa/min, latencia avg/min/max/p50/p95/p99, tops,
  errores recientes, timeline.
- **Tests unitarios con Vitest** (cobertura ≥ 70% en módulos core).
- **Gestor de Configuración simplificado**: Carga nativa de `.env`, lectura de
  `logger.config.json`, interpolación de variables `${VAR}` y validación al arranque.

### Changed

- Filtro **Status** en Traffic log: select (grupos + códigos comunes), no input libre.
- Columna de cliente muestra **IP:puerto**.
- Actualizado el punto de entrada `src/index.js` para exponer todos los módulos
  de configuración, logging manual, monitoring y utilidades.

### Deprecated

- **`store()` → `save()`:** sigue funcionando con `console.warn` una vez por
  proceso. Eliminación planificada en **v2.0.0**. Ver [MIGRATION.md](MIGRATION.md).
- **`log(level, message)`:** preferir `logInfo` / `logWarning` / `logError` /
  `logDebug`. Eliminación planificada en **v2.0.0**.
