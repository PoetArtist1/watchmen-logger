# Distribución de Responsabilidades y Arquitectura

Este documento define la estructura del proyecto y la división de tareas para el
equipo. Al trabajar de manera asíncrona, ciertas prácticas de versionado y
documentación son obligatorias para todos en cada actualización de código.

## Estructura de Carpetas del Proyecto

Seguiremos la estructura sugerida en la arquitectura del proyecto:

```text
<nombre-paquete>/
├── src/
│   ├── index.js/py              # Punto de entrada principal
│   ├── middleware/              # Componentes de captura
│   ├── storage/                 # Estrategias de persistencia
│   ├── monitoring/              # Sistema de monitoreo y métricas
│   ├── config/                  # Gestión de configuración
│   ├── utils/                   # Utilidades generales
│   └── migrations/              # Scripts de migraciones de BD
├── examples/                    # Ejemplos de uso
├── tests/                       # Tests unitarios e integración
├── docs/                        # Documentación
├── package.json / setup.py      # Configuración del paquete
└── README.md
```

---

## 1. Integrante 1 (Tú): Desarrollador Core y Persistencia

**Carpetas a tu cargo:** `src/middleware/`, `src/storage/`, `src/migrations/`.

**Lo que debes programar:**

- **RF-02: Middleware de Captura Automática:** Programar la función que
  intercepta los _requests_ y _responses_ (extrayendo headers, IPs, body, status
  code, latencia, etc.) sin bloquear el event loop y con overhead < 5ms.
- **RF-04: Estrategias de Persistencia:** Implementar las tres formas de guardar
  la data capturada:
  - Memoria RAM (con buffer circular).
  - SQLite local (archivo `.db`).
  - PostgreSQL (pool de conexiones para producción).
- **Migraciones y Schemas:** Crear los scripts `.sql` para crear las tablas y
  los índices (como `idx_requests_timestamp`) requeridos por las bases de datos.

---

## 2. Integrante 2: Desarrollador Monitoreo y UI (Frontend)

**Carpetas a tu cargo:** `src/monitoring/`.

**Lo que debe programar:**

- **RF-03: Interface Web (SPA):** Construir el dashboard HTML/CSS/JS embebido (<
  500KB) que muestra los gráficos, la tabla de requests, los detalles y filtros
  de búsqueda.
- **RF-03: Endpoints de Métricas:** Programar las rutas HTTP (ej:
  `/api/monitoring/metrics` y `/api/monitoring/requests`) que servirán los datos
  en formato JSON a la interfaz web.
- **Paginación:** Implementar la lógica de paginación basada en cursor
  solicitada en la tabla de requests.
- **Playwright UI Testing:** Configurar y escribir las pruebas de componentes en
  navegador real para la interfaz web.

---

## 3. Integrante 3: Configuración, API y Utilidades

**Carpetas a tu cargo:** `src/config/`, `src/utils/`, `src/index.js` (o `.py`).

**Lo que debe programar:**

- **RF-06: Configuración JSON y `.env`:** Programar el módulo que lee
  `logger.config.json`, inyecta los valores seguros desde el archivo `.env`
  (resolviendo variables como `${VAR_NAME}`) y valida que los tipos de datos
  sean correctos al inicio de la aplicación.
- **RF-05: API de Logging Manual:** Programar los métodos públicos `logInfo`,
  `logWarning`, `logError` y `logDebug`. _(Estos métodos se conectarán al motor
  de guardado que hizo el Integrante 1)_.
- **Módulos de Utilidad:** Programar la generación de UUIDs v4, el
  enmascaramiento de datos sensibles (contraseñas/cookies) y el formato ISO 8601
  de fechas.
- **RF-01: Instalación Base:** Configurar el proyecto inicial para que no
  requiera instalación de software adicional, asegurando que se distribuya
  limpiamente en NPM o PyPI.

---

## ⚠️ Responsabilidades Compartidas (Obligatorias por Push/PR)

Al trabajar desde casa y en distintos horarios, todo código enviado al
repositorio principal debe cumplir obligatoriamente con esto:

1. **RF-08: Versionado Semántico y CHANGELOG:**
   - Quien haga un _merge_ o _push_ a la rama principal debe agregar su cambio
     al archivo `CHANGELOG.md` siguiendo el estándar _Keep a Changelog_ (sección
     Added, Changed, Fixed, etc.).
   - Decidir en equipo si el release es MAJOR, MINOR o PATCH antes de publicar.
2. **RF-09: Proceso de Deprecación:**
   - Si alguien necesita renombrar o eliminar una función, configuración o
     endpoint, **no puede borrarlo inmediatamente**. Debe marcarlo con
     `@deprecated`, agregar el `console.warn()` y documentar el cambio en
     `MIGRATION.md` para el próximo MAJOR release.
3. **RF-07: Testing Unitario Continuo:**
   - Cada integrante es responsable de escribir las pruebas de Vitest para su
     propio código (el objetivo global del equipo es > 70% de cobertura en los
     módulos core).
4. **Documentación:**
   - Todos deben nutrir los archivos `README.md`, `ARCHITECTURE.md` y documentar
     sus propias funciones con JSDoc/docstrings.
