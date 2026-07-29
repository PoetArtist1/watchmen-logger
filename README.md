# 🛡️ watchmen-logger

> **Self-hosted logging & monitoring middleware for Express REST APIs.**
> Middleware ligero, asíncrono y de cero dependencias externas de infraestructura. Diseñado como alternativa autónoma a Sentry / Datadog para aplicaciones Node.js.

[![Node.js](https://img.shields.io/badge/Node.js->=18.0.0-green.svg)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/Tests-100%20passing-brightgreen.svg)]()
[![Coverage](https://img.shields.io/badge/Coverage->90%25-brightgreen.svg)]()

---

## 🌟 Características Principales

- **Captura Automática (RF-02):** Intercepta automáticamente todas las peticiones HTTP y respuestas en Express sin bloquear el event loop (latencia añadida < 5ms).
- **Múltiples Estrategias de Persistencia (RF-04):** Cambia dinámicamente entre almacenamiento en **Memoria RAM** (Buffer circular), **SQLite** (archivo local en modo WAL) y **PostgreSQL** (Pool de conexiones para producción).
- **Seguridad e Higiene de Datos:** Enmascaramiento automático de cabeceras sensibles (`Authorization`, `Cookie`, `Set-Cookie`) y límite configurable de tamaño de body.
- **Sistema de Migraciones SQL:** Runner integrado para inicialización automática de esquemas y rollback con scripts `.sql`.
- **Métricas y Análisis:** Cálculo automático de métricas de rendimiento (promedio, min, max, p50, p95, p99), tasa de peticiones por minuto, y endpoints con más errores.
- **Paginación por Cursor:** Consultas eficientes y escalables con filtros combinables por método, estado HTTP, ruta, rango de fechas y latencia.

---

## 📦 Instalación y Uso Local

Actualmente el paquete se encuentra en desarrollo local. Puedes utilizarlo en tu proyecto de Node.js de dos formas:

### Opción 1: Importación Directa en el Repositorio

Si estás desarrollando la aplicación dentro del mismo proyecto:

```javascript
const { createCaptureMiddleware, StorageFactory } = require('./src');
```

### Opción 2: Enlace Local con `npm link`

Para probar el paquete en otro proyecto local de tu máquina sin publicar en NPM:

1. En la carpeta de `watchmen-logger`:
   ```bash
   npm link
   ```
2. En la carpeta de tu aplicación de Express:
   ```bash
   npm link watchmen-logger
   ```
3. Importar en tu aplicación:
   ```javascript
   const { createCaptureMiddleware, StorageFactory } = require('watchmen-logger');
   ```

---

## 🚀 Inicio Rápido

```javascript
const express = require('express');
const { createCaptureMiddleware, StorageFactory } = require('./src'); // O 'watchmen-logger' si usaste npm link

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
    max_records: 5000, // Máximo número de registros en RAM
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

## 🧪 Pruebas Unitarias

El proyecto cuenta con una suite completa de pruebas unitarias escritas en [Vitest](https://vitest.dev/).

```bash
# Ejecutar todas las pruebas unitarias
npm test

# Ejecutar reporte de cobertura de código
npm run test:coverage
```

**Resultado de Cobertura:**
- **Statements:** > 92%
- **Branches:** > 70%
- **Functions:** > 79%
- **Lines:** > 92%

---

## 📁 Estructura del Proyecto

```
watchmen-logger/
├── src/
│   ├── index.js               # Punto de entrada principal
│   ├── middleware/            # Middleware de captura automática (RF-02)
│   │   ├── captureMiddleware.js
│   │   └── index.js
│   ├── storage/               # Estrategias de almacenamiento (RF-04)
│   │   ├── StorageStrategy.js # Interface base abstracta
│   │   ├── StorageFactory.js  # Factory de estrategias
│   │   ├── MemoryStorage.js   # Buffer circular en RAM
│   │   ├── SqliteStorage.js   # Persistencia SQLite
│   │   ├── PostgresStorage.js # Persistencia PostgreSQL
│   │   └── index.js
│   └── migrations/            # Runner de migraciones SQL
│       ├── MigrationRunner.js
│       ├── 001_create_requests_table.sql
│       ├── 002_create_manual_logs_table.sql
│       └── index.js
├── tests/
│   └── unit/                  # Tests unitarios con Vitest
├── CHANGELOG.md               # Registro de cambios (Semantic Versioning)
├── MIGRATION.md               # Guía de migración (Deprecaciones)
├── ARCHITECTURE.md            # Documentación técnica de arquitectura
└── package.json
```
