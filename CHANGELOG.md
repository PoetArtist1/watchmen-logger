# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-29

### Added

- **Interface web de monitoreo (RF-03):** SPA embebida en `src/monitoring/ui`
  ("Signal Desk") con dashboard, lista filtrable, detalle y login; endpoints
  `/api/monitoring`, `/metrics`, `/requests`, `/requests/:id`; paginación por
  cursor; auth por cookie HMAC; `logger.monitoring()` / `logger.attach(app)` y
  demo `npm run demo`.
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
  query params, body, IP del cliente, user agent, status code, latencia, tamaño
  de respuesta, mensajes de error y stack traces para errores 5xx.
- **Estrategia de almacenamiento en memoria (RF-04):** Implementación con buffer
  circular y evicción FIFO al alcanzar el límite de registros. Incluye limpieza
  automática periódica configurable.
- **Estrategia de almacenamiento SQLite (RF-04):** Persistencia en archivo `.db`
  local usando `better-sqlite3`. Crea tablas e índices automáticamente, con modo
  WAL por defecto y soporte para auto-vacuum.
- **Estrategia de almacenamiento PostgreSQL (RF-04):** Pool de conexiones con
  `pg`, soporte para connection string o parámetros individuales, SSL
  configurable, auto-migrate, y prepared statements para seguridad.
- **Sistema de migraciones:** Runner que ejecuta archivos `.sql` numerados,
  tracking en tabla `_migrations`, soporte para rollback con archivos `.down.sql`.
- **Interfaz StorageStrategy:** Clase base abstracta con Strategy Pattern para
  intercambiar backends sin cambiar el código consumidor.
- **StorageFactory:** Factory que instancia la estrategia correcta según
  configuración (`memory`, `sqlite`, `postgresql`).
- **Paginación por cursor:** Implementada en las tres estrategias de storage,
  con soporte para `limit`, `order`, `cursor`, y `total_count`.
- **Filtros combinables:** Por método HTTP, status code, path (búsqueda parcial),
  rango de fechas, rango de latencia, y flag `has_error`.
- **Cálculo de métricas:** Totales, por método, por status, tasa/minuto,
  latencia avg/min/max/p50/p95/p99, top endpoints, endpoints más lentos,
  errores recientes, y timeline por minuto.
- **Soporte para logs manuales:** Tabla `manual_logs` para la API de logging
  manual (RF-05). Almacenamiento y consulta con filtros y paginación.
- **Enmascaramiento de headers sensibles:** Headers como `authorization` y
  `cookie` se reemplazan por `[REDACTED]` automáticamente.
- **Tests unitarios con Vitest:** Suite cubriendo storage (MemoryStorage,
  SqliteStorage, StorageFactory), middleware, MigrationRunner, config, utils
  y API de logging manual. Cobertura >70% en módulos core.
- **Esquemas SQL:** Archivos de migración para crear tablas `requests` y
  `manual_logs` con todos los campos e índices requeridos por el PRD.

### Deprecated

- **`store()` en StorageStrategy:** Reemplazado por `save()` para consistencia
  con convenciones de ORMs. `store()` sigue funcionando pero emite un
  `console.warn` la primera vez que se invoca. Será eliminado en v1.0.0.
  Ver [MIGRATION.md](MIGRATION.md) para la guía de migración.
- **`log(level, message)` en WatchmenLogger:** Reemplazado por `logInfo` /
  `logWarning` / `logError` / `logDebug`. Emite `console.warn` una vez por
  proceso. Será eliminado en v1.0.0. Ver [MIGRATION.md](MIGRATION.md).
