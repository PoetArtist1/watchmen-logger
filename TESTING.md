# Testing Strategy — watchmen-logger

Este documento describe **qué se prueba, con qué herramienta y cómo correrlo**
(RF-07). El paquete combina lógica de servidor (middleware, storage, config) con
una SPA embebida de monitoreo; por eso hay **dos capas**.

---

## 1. Vitest — lógica y API (obligatorio)

| Aspecto | Detalle |
|---------|---------|
| Runner | [Vitest](https://vitest.dev/) |
| Entorno | Node |
| Ubicación | `tests/unit/**/*.test.js` |
| Cobertura objetivo | ≥ 70% en módulos core (`storage`, `middleware`, `config`, `utils`; también router de `monitoring` excluyendo assets UI) |

**Qué cubre**

- Middleware de captura (RF-02)
- Estrategias de storage y factory (RF-04)
- Config / `.env` / validación (RF-06)
- API manual `logInfo` / `logWarning` / `logError` / `logDebug` (RF-05)
- Utilidades (UUID, fechas, masking)
- Router de monitoring: métricas, lista con cursor, detalle, auth (RF-03 backend)

**Comandos**

```bash
npm test              # suite unitaria
npm run test:watch    # modo watch
npm run test:coverage # reporte + umbrales en vitest.config.js
```

---

## 2. Playwright — UI del Signal Desk (RF-03)

La interface es **Vanilla JS sin bundler**, así que no usamos Playwright
Component Testing acoplado a React/Vue. En su lugar usamos **Playwright Test**
contra un servidor Express mínimo que monta `createMonitoringRouter` con
`MemoryStorage` sembrado. Eso ejercita los organismos reales (dashboard, lista,
detalle, login) en Chromium.

| Aspecto | Detalle |
|---------|---------|
| Runner | `@playwright/test` |
| Ubicación | `tests/ui/**/*.spec.js` |
| Navegador | Chromium (por defecto) |

**Qué cubre**

- Carga del shell / brand “watchmen”
- Dashboard con métricas visibles tras seed
- Navegación a lista de requests y filas
- Apertura del detalle (drawer)
- Flujo de login cuando `auth.enabled = true`

**Comandos**

```bash
# Primera vez (descarga Chromium)
npx playwright install chromium

npm run test:ui
# o
npx playwright test
```

---

## 3. Qué no se prueba aquí

- `PostgresStorage` en CI sin Docker (excluido de coverage / opcional manual)
- Carga visual pixel-perfect / regresiones de screenshot (fuera de alcance actual)
- Publicación NPM end-to-end

---

## 4. Responsabilidad por integrante

| Área | Tests esperados |
|------|-----------------|
| Integrante 1 — middleware / storage | Vitest en `tests/unit/middleware`, `storage`, `migrations` |
| Integrante 2 — monitoring UI | Vitest router + Playwright en `tests/ui` |
| Integrante 3 — config / utils / Logger | Vitest en `tests/unit/config`, `utils`, `Logger.test.js` |

Cada PR debe incluir tests del código que toca y no bajar la cobertura de core
por debajo del umbral configurado.
