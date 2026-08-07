# 🛡️ watchmen-logger

> **Self-hosted logging & monitoring middleware for Express REST APIs.**
> Middleware ligero, asíncrono y de cero dependencias externas de infraestructura. Diseñado como alternativa autónoma a Sentry / Datadog para aplicaciones Node.js.

[![npm version](https://img.shields.io/npm/v/watchmen-logger.svg)](https://www.npmjs.com/package/watchmen-logger)
[![Node.js](https://img.shields.io/badge/Node.js->=18.0.0-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-161%20passing-brightgreen.svg)]()
[![Coverage](https://img.shields.io/badge/Coverage->91%25-brightgreen.svg)]()

---

## 🌟 Características Principales

- **Captura Automática (RF-02):** Intercepta automáticamente todas las peticiones HTTP y respuestas en Express sin bloquear el event loop (latencia añadida < 5ms).
- **Configuración JSON + `.env` (RF-06):** `logger.config.json` con secretos vía variables `${VAR}` resueltas desde `.env` / entorno del sistema.
- **Logging Manual (RF-05):** `logInfo`, `logWarning`, `logError`, `logDebug` persistidos en la misma estrategia de storage.
- **Múltiples Estrategias de Persistencia (RF-04):** Cambia dinámicamente entre almacenamiento en **Memoria RAM** (Buffer circular), **SQLite** (archivo local en modo WAL) y **PostgreSQL** (Pool de conexiones para producción).
- **Seguridad e Higiene de Datos:** Enmascaramiento automático de cabeceras sensibles (`Authorization`, `Cookie`, `Set-Cookie`) y límite configurable de tamaño de body.
- **Sistema de Migraciones SQL:** Runner integrado para inicialización automática de esquemas y rollback con scripts `.sql`.
- **Métricas y Análisis:** Cálculo automático de métricas de rendimiento (promedio, min, max, p50, p95, p99), tasa de peticiones por minuto, y endpoints con más errores.
- **Paginación por Cursor:** Consultas eficientes y escalables con filtros combinables por método, estado HTTP, ruta, rango de fechas y latencia.
- **Interface Web / Signal Desk (RF-03):** SPA embebida en `/api/monitoring` con dashboard, lista filtrable, detalle de request y login opcional.

---

## 📦 Instalación

Puedes instalar el paquete directamente desde **NPM** en tu proyecto:

```bash
# Con NPM
npm install watchmen-logger

# Con pnpm
pnpm add watchmen-logger

# Con Yarn
yarn add watchmen-logger
```

---

## 🚀 Inicio Rápido

### Opción recomendada: `createLogger()` (RF-01 / RF-05 / RF-06)

```javascript
const express = require('express');
const { createLogger } = require('watchmen-logger');

async function bootstrap() {
  const app = express();
  app.use(express.json());

  // Carga logger.config.json + .env, valida y monta storage
  const logger = await createLogger();

  // Captura HTTP + monta la UI de monitoreo (RF-03)
  logger.attach(app);

  app.get('/api/users', async (req, res) => {
    await logger.logInfo('Listing users', { requestId: req.requestId });
    res.json([{ id: 1, name: 'Alice' }]);
  });

  app.listen(3000, () => {
    logger.logInfo('Servidor listo', { port: 3000 });
    // UI: http://localhost:3000/api/monitoring/
  });
}

bootstrap();
```

Copia `logger.config.example.json` → `logger.config.json` y `.env.example` → `.env`.
Los secretos van en `.env` y se referencian en el JSON como `${LOGGER_DB_PASSWORD}`.

### Opción manual: `StorageFactory` + `createCaptureMiddleware`

```javascript
const express = require('express');
const { createCaptureMiddleware, StorageFactory } = require('watchmen-logger');

async function bootstrap() {
  const app = express();
  app.use(express.json());

  // 1. Inicializar la estrategia de almacenamiento (ej. SQLite)
  const storage = StorageFactory.create({
    strategy: 'sqlite',
    config: { database_path: './logs/app.db' }
  });
  await storage.initialize();

  // 2. Registrar el middleware de captura automática
  app.use(createCaptureMiddleware(storage, {
    excluded_paths: ['/health', '/favicon.ico'],
    mask_sensitive_data: true
  }));

  // Sus rutas normales de Express
  app.get('/api/users', (req, res) => {
    res.json([{ id: 1, name: 'Alice' }]);
  });

  app.listen(3000, () => {
    console.log('Servidor corriendo en puerto 3000');
  });
}

bootstrap();
```

---

## 📡 Monitoring UI — Signal Desk (RF-03)

El paquete incluye una SPA embebida (HTML/CSS/JS, sin build) servida bajo el endpoint configurado en `monitoring.endpoint` (por defecto `/api/monitoring`).

### Endpoints

| Ruta | Descripción |
|------|-------------|
| `GET /api/monitoring/` | SPA (dashboard, lista, detalle, login) |
| `GET /api/monitoring/metrics` | Métricas agregadas (JSON) |
| `GET /api/monitoring/requests` | Lista con paginación por cursor + filtros |
| `GET /api/monitoring/requests/:id` | Detalle de una request |

### Dashboard

Muestra total de requests, tasa/min, errores, uptime/latencia, gráficos de método/status/timeline, top endpoints, endpoints lentos y errores recientes (auto-refresh configurable y pausable).

---

## 📝 Logging Manual (RF-05)

```javascript
await logger.logInfo('Evento informativo', { userId: 1 });
await logger.logWarning('Algo sospechoso', { ip: '1.2.3.4' });
await logger.logError('Fallo de negocio', new Error('boom'), { orderId: 9 });
await logger.logDebug('Detalle de depuración');
```

---

## ⚙️ Opciones de Configuración

### Middleware (`createCaptureMiddleware`)

| Opción | Tipo | Valor por Defecto | Descripción |
|--------|------|-------------------|-------------|
| `request_headers` | `boolean` | `true` | Capturar cabeceras de la petición |
| `request_body` | `boolean` | `true` | Capturar cuerpo de la petición |
| `request_query` | `boolean` | `true` | Capturar parámetros de consulta |
| `response_headers` | `boolean` | `true` | Capturar cabeceras de la respuesta |
| `response_body` | `boolean` | `false` | Capturar cuerpo de la respuesta |
| `max_body_size_kb` | `number` | `100` | Tamaño máximo de body en KB antes de truncar |
| `excluded_paths` | `string[]` | `[]` | Rutas a ignorar (soporta comodín `*`) |
| `excluded_methods` | `string[]` | `[]` | Métodos HTTP a ignorar (ej. `['OPTIONS']`) |
| `sensitive_headers` | `string[]` | `['authorization', 'cookie', 'set-cookie']` | Cabeceras a ocultar |
| `mask_sensitive_data` | `boolean` | `true` | Activar/desactivar enmascaramiento |

---

## 🗄️ Estrategias de Almacenamiento

### 1. Almacenamiento en Memoria (`memory`)
Buffer circular FIFO ideal para pruebas y entornos de desarrollo sin dependencias de disco.

```javascript
const storage = StorageFactory.create({
  strategy: 'memory',
  config: {
    max_records: 5000,
    cleanup_interval_minutes: 60
  }
});
```

### 2. Almacenamiento en SQLite (`sqlite`)
Persistencia ligera en archivo local con soporte para transacciones y modo WAL.

```javascript
const storage = StorageFactory.create({
  strategy: 'sqlite',
  config: {
    database_path: './data/logger.db',
    wal_mode: true
  }
});
```

### 3. Almacenamiento en PostgreSQL (`postgresql`)
Pool de conexiones para entornos de producción de alto rendimiento.

```javascript
const storage = StorageFactory.create({
  strategy: 'postgresql',
  config: {
    host: 'localhost',
    port: 5432,
    database: 'watchmen_db',
    user: 'postgres',
    password: 'password',
    pool_size: 10,
    ssl: false
  }
});
```

---

## 🧪 Pruebas

Ver estrategia completa en [`TESTING.md`](./TESTING.md).

```bash
npm test              # Vitest (unitario + API monitoring)
npm run test:coverage # Cobertura
npm run test:ui       # Playwright — UI real del Signal Desk
```

---

## 📁 Estructura del Proyecto

```
watchmen-logger/
├── src/
│   ├── index.js               # Punto de entrada principal
│   ├── Logger.js              # createLogger + API logInfo/Warning/Error/Debug
│   ├── config/                # Carga JSON, .env y validación (RF-06)
│   ├── utils/                 # UUID, fechas ISO 8601, masking
│   ├── middleware/            # Middleware de captura automática (RF-02)
│   ├── monitoring/            # UI Signal Desk + APIs de métricas (RF-03)
│   │   ├── createMonitoringRouter.js
│   │   ├── auth.js
│   │   └── ui/                # SPA HTML/CSS/JS (componentes)
│   ├── storage/               # Estrategias de almacenamiento (RF-04)
│   └── migrations/            # Runner de migraciones SQL
├── examples/
│   └── demo-server.js         # Demo con UI en :3847
├── tests/
│   ├── unit/                  # Vitest
│   └── ui/                    # Playwright (UI monitoring)
├── logger.config.example.json
├── .env.example
├── TESTING.md
├── CHANGELOG.md
├── MIGRATION.md
├── ARCHITECTURE.md
└── package.json
```
