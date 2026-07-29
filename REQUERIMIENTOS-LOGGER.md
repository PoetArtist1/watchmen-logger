# PRD: Paquete de Logging y Monitoreo para REST APIs

## 1. Información General

### 1.1 Descripción del Proyecto
Desarrollo de un paquete NPM/PyPI que funcione como sistema de logging y monitoreo para REST APIs, ofreciendo una alternativa autoalojada a servicios como Sentry SDK. El paquete permite capturar, almacenar y visualizar información sobre requests y responses sin dependencias de servicios externos.

### 1.2 Objetivos del Proyecto
- Crear un paquete reutilizable siguiendo el paradigma de programación basada en componentes, con la tecnología de UI de preferencia del equipo
- Proporcionar captura automática de requests/responses mediante middleware
- Ofrecer monitoreo en tiempo real de métricas de la API
- Implementar múltiples estrategias de persistencia de datos
- Permitir configuración flexible mediante archivos JSON con soporte de variables de entorno para valores sensibles
- Incorporar testing automatizado (unitario para lógica, component testing para UI)
- Publicar el paquete en un registro público (NPM, PyPI o GitHub Packages) con versionado semántico y disciplina de mantenimiento profesional

### 1.3 Nombre del Paquete
El equipo debe seleccionar un nombre original y descriptivo para el paquete. Se sugiere usar nomenclatura que refleje su propósito de logging/monitoreo.

---

## 2. Stack Tecnológico

### 2.1 Opción A: Node.js
- **Framework Backend**: Express o Fastify
- **Lenguaje**: JavaScript o TypeScript
- **Base de Datos Local**: better-sqlite3 o similar
- **Base de Datos Remota**: pg (PostgreSQL)
- **Distribución**: NPM o GitHub Packages

### 2.2 Opción B: Python
- **Framework Backend**: FastAPI
- **Lenguaje**: Python 3.8+
- **Base de Datos Local**: sqlite3
- **Base de Datos Remota**: psycopg2 (PostgreSQL)
- **Distribución**: PyPI o GitHub Packages

---

## 3. Requerimientos Funcionales

### RF-01: Instalación Sin Dependencias Externas

**Descripción**: El paquete debe instalarse mediante un único comando y funcionar sin requerir instalación de software adicional.

**Especificaciones**:
- Instalación mediante gestor de paquetes estándar (npm/pip)
- Todas las dependencias se instalan automáticamente
- No requiere instalación de servidores de base de datos externos
- Incluye base de datos local embebida (SQLite)
- Funcional con configuración mínima o por defecto

**Restricciones**:
- No puede requerir instalación manual de otros programas
- No puede depender de servicios cloud externos
- Todas las dependencias deben estar disponibles en el registro público correspondiente

---

### RF-02: Middleware de Captura Automática

**Descripción**: El paquete debe funcionar como middleware que intercepta automáticamente todas las requests y responses de la API.

**Datos Requeridos por Request**:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| timestamp | DateTime ISO 8601 | Fecha y hora exacta de la request |
| method | String | Método HTTP (GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD) |
| full_url | String | URL completa de la request |
| path | String | Path del endpoint solicitado |
| headers | Object/Dict | Headers de la request |
| query_params | Object/Dict | Query parameters |
| body | Object/Dict/String | Body de la request (si aplica) |
| client_ip | String | IP del cliente |
| user_agent | String | User-agent del cliente |
| request_id | UUID v4 | Identificador único de la request |

**Datos Requeridos por Response**:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| status_code | Integer | Código de estado HTTP (100-599) |
| headers | Object/Dict | Headers de la response |
| body | Object/Dict/String | Body de la response (configurable) |
| latency_ms | Integer | Tiempo de respuesta en milisegundos |
| response_size_bytes | Integer | Tamaño de la response en bytes |
| error_message | String | Mensaje de error (si status >= 400) |
| stack_trace | String | Stack trace (opcional, solo para errores 5xx) |

**Especificaciones Técnicas**:

| Requisito | Especificación |
|-----------|----------------|
| Compatibilidad | Compatible con el framework seleccionado (Express/Fastify/FastAPI) |
| Bloqueo | No debe bloquear el flujo normal de requests |
| Cobertura | Debe capturar incluso requests que resulten en error |
| Content-Type | Debe funcionar con cualquier tipo de content-type |
| Impacto en latencia | Máximo 5ms adicionales de overhead |

---

### RF-03: Sistema de Monitoreo con Interface Web

**Descripción**: El paquete debe exponer un endpoint que sirva una interfaz web completa para monitorear, visualizar y navegar a través de las requests capturadas.

**Endpoints Requeridos**:

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/monitoring` | GET | Sirve la interfaz web (HTML/CSS/JS) |
| `/api/monitoring/metrics` | GET | API que retorna métricas en JSON |
| `/api/monitoring/requests` | GET | API que retorna lista de requests con paginación |
| `/api/monitoring/requests/:id` | GET | API que retorna detalle de una request específica |

**Interface Web - Requerimientos**:

La interfaz web debe ser una Single Page Application (SPA) embebida en el paquete que permita:

**Características de la Interface**:

| Funcionalidad | Descripción |
|---------------|-------------|
| Dashboard de Métricas | Vista principal con estadísticas en tiempo real |
| Lista de Requests | Tabla navegable con todas las requests capturadas |
| Paginación por Cursor | Navegación eficiente a través de grandes volúmenes |
| Filtros | Por método, status code, endpoint, rango de fechas |
| Búsqueda | Búsqueda por texto en paths o IDs |
| Vista de Detalle | Modal o página con información completa de una request |
| Auto-refresh | Actualización automática de métricas (configurable) |
| Responsive Design | Funcional en desktop y mobile |

**Paginación por Cursor - Especificaciones**:

La API `/api/monitoring/requests` debe implementar paginación por cursor:

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| cursor | String | Cursor para continuar desde última posición |
| limit | Integer | Cantidad de registros por página (default: 50, max: 200) |
| order | String | Orden de resultados ('asc' o 'desc', default: 'desc') |

**Estructura de Response con Paginación**:

```json
{
  "data": [...],
  "pagination": {
    "has_more": true,
    "next_cursor": "encoded_cursor_string",
    "prev_cursor": "encoded_cursor_string",
    "total_count": 1523
  }
}
```

**Dashboard de Métricas - Componentes Visuales Requeridos**:

| Componente | Tipo de Visualización | Datos |
|------------|----------------------|-------|
| Resumen General | Cards con números grandes | Total requests, Tasa/min, Errores, Uptime |
| Distribución por Método | Gráfico de barras o pie | Conteo por GET, POST, PUT, DELETE, etc. |
| Distribución por Status | Gráfico de barras apiladas | Agrupado por 2xx, 3xx, 4xx, 5xx |
| Timeline de Requests | Gráfico de línea temporal | Requests por minuto en últimas horas |
| Performance | Gráfico de línea | Latencia promedio en el tiempo |
| Top Endpoints | Tabla ordenada | Endpoints más solicitados |
| Endpoints Lentos | Tabla ordenada | Endpoints con mayor latencia promedio |
| Errores Recientes | Lista cronológica | Últimos errores con detalles |

**Filtros de Búsqueda - Especificaciones**:

La tabla de requests debe soportar filtros combinables:

| Filtro | Tipo | Opciones/Formato |
|--------|------|------------------|
| Método HTTP | Multi-select | GET, POST, PUT, DELETE, PATCH, OPTIONS |
| Status Code | Multi-select o rango | 200, 201, 400, 404, 500, etc. |
| Endpoint/Path | Text input | Búsqueda parcial en path |
| Rango de Fechas | Date picker | Desde - Hasta (ISO 8601) |
| Latencia | Rango numérico | Min - Max en milisegundos |
| Has Error | Boolean | Solo requests con error |

**Vista de Detalle de Request - Información Completa**:

| Sección | Contenido |
|---------|-----------|
| General | Request ID, Timestamp, Método, Path completo, Status code |
| Performance | Latencia, Tamaño de response, Tiempo de procesamiento |
| Request Info | Headers (tabla), Query params (tabla), Body (JSON viewer) |
| Response Info | Headers (tabla), Body (JSON viewer con syntax highlight) |
| Error Info | Mensaje de error, Stack trace (si disponible) |
| Client Info | IP address, User agent |

**Tecnologías Sugeridas para Interface**:

| Aspecto | Tecnología Recomendada |
|---------|------------------------|
| Framework JS | Vanilla JS, Vue.js, React (embebido) |
| Estilos | CSS puro o Tailwind CSS (via CDN) |
| Gráficos | Chart.js o similar (via CDN) |
| Iconos | Font Awesome o similar (via CDN) |
| Empaquetado | Todo en un solo HTML con inline CSS/JS |

**Auto-refresh - Especificaciones**:

| Característica | Valor |
|----------------|-------|
| Interval por defecto | 30 segundos |
| Configurable | Desde 5 segundos hasta 5 minutos |
| Pausable | Usuario puede pausar/reanudar |
| Solo en dashboard | No auto-refresh en vista de lista/detalle |

**Autenticación de la Interface**:

El sistema de monitoreo debe incluir autenticación básica simple cuando esté habilitada en la configuración:

- **Tipo**: Autenticación HTTP Basic o formulario de login simple
- **Credenciales**: Usuario y contraseña configurables vía JSON
- **Implementación**: Sin JWT, tokens complejos ni OAuth - solo validación de credenciales
- **Sesión**: Mantener sesión activa mediante cookies o localStorage
- **Pantalla de Login**: Formulario HTML simple con campos de usuario y contraseña
- **Timeout**: Sesión expira después de tiempo configurable (default: 1 hora)
- **Logout**: Opción visible para cerrar sesión
- **Sin autenticación**: Si auth está deshabilitado, la interface es de acceso público

**Consideraciones de Implementación**:

| Aspecto | Especificación |
|---------|----------------|
| Tamaño del archivo | Debe ser lo más ligero posible (< 500KB total) |
| Sin build process | HTML/CSS/JS que funciona sin compilación |
| CDN para dependencias | Chart.js, iconos, etc. desde CDN públicos |
| Responsive breakpoints | Mobile: < 768px, Tablet: 768-1024px, Desktop: > 1024px |
| Compatibilidad | Chrome, Firefox, Safari, Edge (últimas 2 versiones) |

**Métricas en Tiempo Real - API Response**:

El endpoint `/api/monitoring/metrics` debe retornar:

| Categoría | Métricas Incluidas |
|-----------|-------------------|
| Requests | Total, por método, por status, tasa/minuto |
| Performance | Latencia avg/min/max, percentiles p50/p95/p99 |
| Errores | Total 4xx, total 5xx, distribución por endpoint |
| Sistema | Uptime, versión, memoria, CPU (opcional) |
| Top Lists | Top 10 endpoints, Top 10 más lentos |

**Estructura Componentizada de la Interface**:

La interface web debe construirse siguiendo el paradigma de programación basada en componentes, con la tecnología de preferencia del equipo (Vanilla JS, React, Vue, Svelte, u otras). No se prescribe una metodología específica de organización — el equipo decide cómo estructurar la jerarquía de componentes, siempre y cuando la separación entre lógica, estado y presentación sea clara y defendible durante la exposición oral.

Cada componente debe vivir en su propia carpeta o módulo con estilos y lógica separados. La estructura de carpetas debe reflejar de manera coherente el diseño elegido por el equipo.

---

### RF-04: Estrategias de Persistencia Múltiples

**Descripción**: El paquete debe soportar tres estrategias diferentes de almacenamiento de datos, seleccionables mediante configuración.

#### 4.1 Estrategia 1: Memoria RAM (Volátil)

**Características**:

| Aspecto | Especificación |
|---------|----------------|
| Ubicación | Almacenamiento en memoria durante ejecución del proceso |
| Persistencia | Datos se pierden al reiniciar la aplicación |
| Velocidad | Acceso más rápido (sin I/O de disco) |
| Uso | Apropiado para desarrollo y testing |

**Configuraciones Requeridas**:

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| max_records | Integer | Cantidad máxima de registros en memoria |
| cleanup_enabled | Boolean | Habilitar limpieza automática periódica |
| cleanup_interval_minutes | Integer | Intervalo de ejecución de limpieza |
| cleanup_older_than_hours | Integer | Eliminar registros más antiguos que X horas |

**Funcionalidades**:

| Funcionalidad | Descripción |
|---------------|-------------|
| Estructura de datos | Circular buffer o estructura similar eficiente |
| Comportamiento FIFO | Al alcanzar límite, elimina el registro más antiguo |
| Búsqueda | Búsqueda rápida de registros recientes |
| Cálculo de métricas | Sin necesidad de queries a disco |
| Liberación de memoria | Automática al eliminar registros |

#### 4.2 Estrategia 2: Base de Datos Local (SQLite)

**Características**:

| Aspecto | Especificación |
|---------|----------------|
| Ubicación | Persistencia en archivo de base de datos local |
| Servidor | No requiere servidor de base de datos |
| Portabilidad | Archivo de base de datos es portable |
| Uso | Apropiado para aplicaciones pequeñas a medianas |

**Configuraciones Requeridas**:

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| database_path | String | Ruta del archivo .db |
| auto_vacuum | Boolean | Habilitar auto vacuum |
| journal_mode | String | Modo de journal (DELETE/WAL/MEMORY) |

**Schema de Base de Datos Requerido**:

Tabla principal: `requests`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID o INTEGER | PRIMARY KEY | Identificador único |
| timestamp | DATETIME | NOT NULL | Timestamp de la request |
| method | VARCHAR(10) | NOT NULL | Método HTTP |
| path | TEXT | NOT NULL | Path del endpoint |
| full_url | TEXT | NOT NULL | URL completa |
| status_code | INTEGER | NOT NULL | Código de estado HTTP |
| latency_ms | INTEGER | NOT NULL | Latencia en milisegundos |
| client_ip | VARCHAR(45) | NULL | IP del cliente (soporta IPv6) |
| user_agent | TEXT | NULL | User agent |
| request_headers | TEXT/JSON | NULL | Headers serializados |
| request_query | TEXT/JSON | NULL | Query params serializados |
| request_body | TEXT/JSON | NULL | Body serializado |
| response_headers | TEXT/JSON | NULL | Headers de response |
| response_body | TEXT/JSON | NULL | Body de response |
| response_size_bytes | INTEGER | NULL | Tamaño de response |
| error_message | TEXT | NULL | Mensaje de error |
| created_at | DATETIME | DEFAULT NOW | Timestamp de inserción |

**Índices Requeridos**:

| Índice | Campo(s) | Orden | Propósito |
|--------|----------|-------|-----------|
| idx_requests_timestamp | timestamp | DESC | Queries de requests recientes |
| idx_requests_path | path | ASC | Agregaciones por endpoint |
| idx_requests_status_code | status_code | ASC | Filtrado por código |
| idx_requests_method | method | ASC | Agregaciones por método |
| idx_requests_latency | latency_ms | ASC | Ordenamiento por performance |

**Funcionalidades**:

| Funcionalidad | Descripción |
|---------------|-------------|
| Creación automática | Tablas se crean automáticamente al inicializar |
| Índices automáticos | Índices se crean junto con las tablas |
| Migrations | Soporte para migrations si cambia el schema |
| Manejo de errores | Manejo graceful de errores de I/O |
| Transacciones | Uso de transacciones para inserciones batch |

#### 4.3 Estrategia 3: PostgreSQL (Producción)

**Características**:

| Aspecto | Especificación |
|---------|----------------|
| Ubicación | Persistencia en servidor PostgreSQL |
| Escalabilidad | Mayor capacidad y escalabilidad |
| Queries | Soporte para queries complejas y reportes |
| Uso | Apropiado para producción y grandes volúmenes |

**Configuraciones Requeridas - Opción A (Connection String)**:

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| connection_string | String | Connection string completo (postgresql://user:pass@host:port/db) |
| pool_size | Integer | Número de conexiones concurrentes |
| timeout_ms | Integer | Timeout de conexión |
| ssl | Boolean | SSL habilitado/deshabilitado |
| auto_migrate | Boolean | Ejecutar migrations automáticamente |

**Configuraciones Requeridas - Opción B (Parámetros Individuales)**:

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| host | String | localhost | Host del servidor PostgreSQL |
| port | Integer | 5432 | Puerto del servidor |
| database | String | - | Nombre de la base de datos |
| user | String | - | Usuario de la base de datos |
| password | String | - | Contraseña del usuario |
| pool_size | Integer | 10 | Tamaño del pool de conexiones |
| ssl | Boolean | false | SSL habilitado/deshabilitado |

**Schema de Base de Datos Requerido**:

Tabla principal: `requests`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Identificador único |
| timestamp | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Timestamp de la request |
| method | VARCHAR(10) | NOT NULL | Método HTTP |
| path | TEXT | NOT NULL | Path del endpoint |
| full_url | TEXT | NOT NULL | URL completa |
| status_code | INTEGER | NOT NULL | Código de estado HTTP |
| latency_ms | INTEGER | NOT NULL | Latencia en milisegundos |
| client_ip | VARCHAR(45) | NULL | IP del cliente |
| user_agent | TEXT | NULL | User agent |
| request_headers | JSONB | NULL | Headers como JSONB |
| request_query | JSONB | NULL | Query params como JSONB |
| request_body | JSONB | NULL | Body como JSONB |
| response_headers | JSONB | NULL | Headers de response |
| response_body | JSONB | NULL | Body de response |
| response_size_bytes | INTEGER | NULL | Tamaño de response |
| error_message | TEXT | NULL | Mensaje de error |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Timestamp de inserción |

**Índices Requeridos**:

| Índice | Tipo | Campo(s) | Propósito |
|--------|------|----------|-----------|
| idx_requests_timestamp | B-tree | timestamp DESC | Queries de requests recientes |
| idx_requests_path | B-tree | path | Agregaciones por endpoint |
| idx_requests_status_code | B-tree | status_code | Filtrado por código |
| idx_requests_method | B-tree | method | Agregaciones por método |
| idx_requests_latency | B-tree | latency_ms | Ordenamiento por performance |
| idx_requests_headers | GIN | request_headers | Búsquedas en JSONB |

**Sistema de Migrations**:

| Aspecto | Especificación |
|---------|----------------|
| Scripts SQL | Archivos .sql numerados para crear schema |
| Comando CLI | Comando para ejecutar migrations manualmente |
| Validación | Validación de conexión antes de ejecutar |
| Rollback | Capacidad de rollback en caso de error |
| Versionado | Tabla de versionado de migrations |

**Funcionalidades**:

| Funcionalidad | Descripción |
|---------------|-------------|
| Pool de conexiones | Manejo inteligente con pool configurable |
| Reconexión automática | Si se pierde la conexión con el servidor |
| Prepared statements | Para mejor performance y seguridad |
| Transacciones | Para operaciones batch |
| Manejo de errores | Manejo graceful de errores de red y timeout |

---

### RF-05: API de Logging Manual

**Descripción**: El paquete debe exponer métodos públicos para que los desarrolladores puedan registrar logs personalizados fuera del middleware automático de captura de requests.

**Métodos Requeridos**:

El paquete debe proporcionar una API simple para logging manual con los siguientes métodos:

**logInfo(message, metadata?)**
- Registrar información general o eventos importantes
- Nivel de severidad: INFO
- Metadata opcional para contexto adicional

**logWarning(message, metadata?)**
- Registrar advertencias o situaciones que requieren atención
- Nivel de severidad: WARNING
- Metadata opcional para contexto adicional

**logError(message, error?, metadata?)**
- Registrar errores y excepciones
- Nivel de severidad: ERROR
- Puede recibir objeto Error para capturar stack trace
- Metadata opcional para contexto adicional

**logDebug(message, metadata?)**
- Registrar información de debugging
- Nivel de severidad: DEBUG
- Metadata opcional para contexto adicional

**Características de los Logs Manuales**:

- **Timestamp automático**: Cada log debe incluir timestamp ISO 8601
- **Contexto**: Capturar información del contexto de ejecución si está disponible
- **Metadata estructurada**: Objeto/diccionario con información adicional
- **Persistencia**: Los logs manuales deben almacenarse en la misma estrategia de storage configurada
- **Visualización**: Deben ser visibles en la interface web de monitoreo
- **Diferenciación**: Deben distinguirse de los logs automáticos de requests

**Estructura de un Log Manual**:

Como mínimo debe incluir:
- ID único del log
- Timestamp
- Nivel de severidad (INFO, WARNING, ERROR, DEBUG)
- Mensaje
- Stack trace (si es un error)
- Metadata adicional (opcional)
- Información de contexto (archivo, línea, función si es posible)

**Integración con Storage**:

Los logs manuales deben:
- Almacenarse en una tabla/colección separada o en la misma con un campo discriminador
- Ser consultables mediante filtros en la interface web
- Incluirse en las métricas de errores si aplica
- Soportar paginación por cursor como los logs de requests

**Uso Esperado**:

Los desarrolladores deben poder usar estos métodos en cualquier parte de su código para registrar eventos importantes, errores de lógica de negocio, advertencias, o información de debugging que no está relacionada directamente con requests HTTP.

---

### RF-06: Configuración mediante JSON

**Descripción**: Toda la configuración del paquete debe realizarse mediante un archivo JSON con estructura bien definida y validada.

**Ubicación del Archivo**:

| Aspecto | Especificación |
|---------|----------------|
| Archivo por defecto | `logger.config.json` en la raíz del proyecto |
| Ruta personalizable | Al inicializar el paquete |
| Variables de entorno | Soporte para referencias tipo `${VAR_NAME}` en cualquier valor del JSON |

**Manejo de Secrets vía `.env` (obligatorio)**:

Los valores sensibles — credenciales de base de datos, contraseñas del monitor, claves de encriptación, o cualquier dato confidencial — **no deben residir en texto plano en `logger.config.json`**. Deben cargarse desde un archivo `.env` en la raíz del proyecto o desde variables de entorno del sistema.

| Aspecto | Especificación |
|---------|----------------|
| Archivo por defecto | `.env` en la raíz del proyecto |
| Momento de carga | Al inicio del proceso o dinámicamente al montar el logger (ambos casos deben ser soportados) |
| Sintaxis del archivo | Formato estándar `KEY=value`, una variable por línea |
| Sustitución en JSON | Referencias `${VAR_NAME}` en el `logger.config.json` se resuelven al montar la configuración |
| Prioridad | Variables del sistema > archivo `.env` > defaults declarados en config |
| Validación | Si una variable referenciada no está definida, el paquete falla con mensaje claro **al arranque**, no en runtime |
| `.env.example` | El paquete debe incluir un archivo de ejemplo con las variables esperadas, sin valores reales |
| Seguridad | El paquete debe recordar (README o docs) que `.env` debe estar en `.gitignore` |

**Ejemplo de uso**:

`.env`:
```
LOGGER_DB_HOST=prod-db.internal
LOGGER_DB_USER=logger_app
LOGGER_DB_PASSWORD=super-secret-value
LOGGER_MONITORING_USER=admin
LOGGER_MONITORING_PASSWORD=another-secret
```

`logger.config.json`:
```json
{
  "storage": {
    "strategy": "postgresql",
    "config": {
      "host": "${LOGGER_DB_HOST}",
      "user": "${LOGGER_DB_USER}",
      "password": "${LOGGER_DB_PASSWORD}",
      "database": "logger_prod",
      "port": 5432
    }
  },
  "monitoring": {
    "auth": {
      "enabled": true,
      "username": "${LOGGER_MONITORING_USER}",
      "password": "${LOGGER_MONITORING_PASSWORD}"
    }
  }
}
```

Al montar el logger, el paquete detecta las referencias `${VAR}`, las resuelve leyendo `.env` y las variables del sistema, y construye la configuración final.

**Estructura del Archivo de Configuración**:

#### Sección: Storage (Obligatoria)
**Propósito**: Definir estrategia de almacenamiento y su configuración específica

| Campo | Tipo | Valores | Descripción |
|-------|------|---------|-------------|
| strategy | String | "memory" \| "sqlite" \| "postgresql" | Estrategia de persistencia |
| config | Object | - | Configuración específica por estrategia |

**Config para Memory**:

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| max_records | Integer | 5000 | Cantidad máxima de registros |
| cleanup_enabled | Boolean | true | Habilitar limpieza automática |
| cleanup_interval_minutes | Integer | 10 | Intervalo de limpieza |
| cleanup_older_than_hours | Integer | 24 | Antigüedad para limpieza |

**Config para SQLite**:

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| database_path | String | "./logs/api_logs.db" | Ruta del archivo .db |
| auto_vacuum | Boolean | true | Auto vacuum |
| journal_mode | String | "WAL" | Modo de journal |

**Config para PostgreSQL (Opción A)**:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| connection_string | String | Connection string completo |
| pool_size | Integer | Tamaño del pool |
| timeout_ms | Integer | Timeout de conexión |
| ssl | Boolean | SSL habilitado |
| auto_migrate | Boolean | Ejecutar migrations automáticamente |

**Config para PostgreSQL (Opción B)**:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| host | String | Host del servidor |
| port | Integer | Puerto del servidor |
| database | String | Nombre de la base de datos |
| user | String | Usuario de la base de datos |
| password | String | Contraseña del usuario |
| pool_size | Integer | Tamaño del pool |
| ssl | Boolean | SSL habilitado |

#### Sección: Capture (Obligatoria)
**Propósito**: Configurar qué datos capturar y cómo procesarlos

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| request_headers | Boolean | true | Capturar headers de request |
| request_body | Boolean | true | Capturar body de request |
| request_query | Boolean | true | Capturar query parameters |
| response_headers | Boolean | true | Capturar headers de response |
| response_body | Boolean | false | Capturar body de response |
| max_body_size_kb | Integer | 100 | Límite de tamaño de body |
| excluded_paths | Array[String] | [] | Paths a ignorar |
| excluded_methods | Array[String] | [] | Métodos HTTP a ignorar |
| sensitive_headers | Array[String] | ["authorization", "cookie"] | Headers a enmascarar |
| mask_sensitive_data | Boolean | true | Enmascarar automáticamente |

#### Sección: Retention (Opcional)
**Propósito**: Configurar políticas de retención y limpieza de datos

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| enabled | Boolean | false | Habilitar sistema de retención |
| max_records | Integer | 10000 | Máximo de registros totales |
| cleanup_interval_minutes | Integer | 30 | Frecuencia de limpieza |
| cleanup_older_than_days | Integer | 7 | Eliminar registros más antiguos que N días |
| archive_before_delete | Boolean | false | Archivar antes de eliminar |
| archive_path | String | null | Ruta para archivos |

#### Sección: Monitoring (Obligatoria)
**Propósito**: Configurar el sistema de monitoreo y la interface web

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| endpoint | String | "/api/monitoring" | Ruta del endpoint principal |
| enabled | Boolean | true | Habilitar/deshabilitar monitoreo |
| cache_metrics | Boolean | true | Cachear métricas calculadas |
| cache_duration_seconds | Integer | 30 | Duración del cache |
| page_size | Integer | 50 | Registros por página (paginación) |
| max_page_size | Integer | 200 | Máximo permitido por página |
| auto_refresh_interval | Integer | 30 | Intervalo de auto-refresh en segundos |

**Subsección: auth (dentro de monitoring)**:

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| enabled | Boolean | false | Habilitar autenticación |
| type | String | "basic" | Tipo de autenticación |
| username | String | null | Usuario para Basic Auth |
| password | String | null | Contraseña para Basic Auth |
| session_timeout_hours | Integer | 1 | Timeout de sesión |

#### Sección: Performance (Opcional)
**Propósito**: Optimizaciones de rendimiento

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| async_logging | Boolean | true | Logging asíncrono |
| batch_size | Integer | 50 | Registros por batch |
| batch_interval_ms | Integer | 1000 | Intervalo para enviar batches |
| max_queue_size | Integer | 1000 | Tamaño máximo de cola en memoria |

**Validaciones Requeridas**:

| Validación | Descripción |
|------------|-------------|
| Campos obligatorios | Verificar existencia de campos requeridos |
| Tipos de datos | Validar tipos correctos (String, Integer, Boolean, etc.) |
| Rangos de valores | Validar valores dentro de límites permitidos |
| Formatos | Validar formato de URLs, paths, connection strings |
| Valores enum | Validar valores contra lista de opciones válidas |
| Dependencias | Validar configuraciones dependientes (ej: auth username requiere password) |
| Mensajes de error | Generar mensajes descriptivos y útiles |
| Defaults | Cargar valores por defecto para campos opcionales |

---

### RF-07: Testing con Vitest + Playwright Component Testing

**Descripción**: El paquete debe incluir dos capas de testing complementarias: unitario para lógica pura y de bajo nivel; component testing en navegador real para la UI de monitoreo.

**Testing unitario con Vitest (obligatorio)**:

| Aspecto | Especificación |
|---------|----------------|
| Test runner | Vitest (obligatorio, no Jest ni otro) |
| Entorno | JSDOM o happy-dom |
| Librería de aserciones | Testing Library para el DOM |
| Cobertura mínima | 70% en los componentes core: storage, middleware, config, utils |
| Ubicación | `tests/unit/` o co-ubicados como `<archivo>.test.ts` |

**Documentación de tests**:
- Archivo `TESTING.md` explicando la estrategia elegida y cómo correr cada capa
- Reporte de coverage generado (`npm test -- --coverage`)

---

### RF-08: Versionado con SemVer y CHANGELOG

**Descripción**: El paquete se rige por **Semantic Versioning 2.0.0** (Preston-Werner, 2013) desde el primer release, y mantiene un `CHANGELOG.md` legible por humanos según el estándar **Keep a Changelog**.

El versionado semántico expresa mediante tres números `MAJOR.MINOR.PATCH` la naturaleza de cada cambio, de modo que un consumidor del paquete pueda saber, con solo mirar el número, si una actualización lo obliga a revisar su código, si le añade capacidades sin romper nada, o si es solo un arreglo interno. El equipo debe versionar cada release del paquete respetando esta semántica, y documentar las decisiones tomadas — en la defensa oral debe poder justificar por qué eligió una categoría u otra para al menos dos de sus releases.

En el contexto de este paquete, un cambio **MAJOR** corresponde a modificaciones que rompen la compatibilidad con versiones anteriores: alteraciones en el shape del `logger.config.json` que invaliden archivos existentes, cambios en las firmas de los métodos públicos del logger, renombrado o eliminación de endpoints del monitor, o cualquier ajuste que obligue al consumidor del paquete a modificar su código para seguir funcionando.

Un cambio **MINOR** corresponde a incorporaciones aditivas y compatibles: nuevas estrategias de storage, nuevos métodos de logging, nuevos campos opcionales en la configuración con defaults sensatos, o nuevos endpoints del monitor. Lo que caracteriza a este nivel es que un consumidor de la versión anterior puede actualizar sin cambiar ni una línea de su propio código.

Un cambio **PATCH** corresponde a arreglos y mejoras internas que no alteran la API pública ni el comportamiento observable: corrección de bugs, mejoras de performance, ajustes de accesibilidad en la interface, o actualizaciones seguras de dependencias internas.

**Archivo `CHANGELOG.md` (obligatorio)**:

- Formato: **Keep a Changelog** (`keepachangelog.com`)
- Ubicación: raíz del repositorio
- Cada release debe listar las entradas bajo `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security` según corresponda
- Los cambios breaking se marcan explícitamente con el prefijo `**BREAKING:**` dentro de `Changed`

**Metadata del paquete (`package.json` / `pyproject.toml`)**:

| Campo | Especificación |
|-------|----------------|
| `version` | Coherente con lo publicado en el registro |
| `name` | Único en el registro elegido |
| `description` | Frase corta y precisa |
| `keywords` | Al menos 4 keywords relevantes |
| `license` | MIT recomendado |
| `repository` | URL al repositorio Git |
| `bugs` | URL a issues |
| `homepage` | URL a la documentación |
| `engines` (Node) / `python_requires` (Python) | Versiones mínimas soportadas |

---

### RF-09: Deprecación como evidencia de madurez

**Descripción**: Como parte de la disciplina de mantenimiento profesional, el equipo debe **planificar y ejecutar al menos una deprecación** dentro de la versión final del paquete. Esto puede ser: un método de logging heredado que fue reemplazado, un campo del JSON de configuración renombrado, o un endpoint de monitoreo alternativo.

La deprecación NO debe romper el paquete — debe convivir con el reemplazo durante la versión actual y estar programada para eliminarse en el siguiente MAJOR.

**Los tres canales obligatorios**:

| Canal | Requerimiento |
|-------|---------------|
| **JSDoc / docstring** | `@deprecated` con mensaje y sugerencia del reemplazo, visible en IDEs |
| **Runtime warning** | `console.warn()` al usar el elemento deprecado, una sola vez por sesión, con link al migration guide |
| **`MIGRATION.md`** | Documento en la raíz explicando el cambio, con código antes/después y motivo del cambio |

**Ejemplo de aplicación válida**:

Si en versiones anteriores el equipo tenía un método `log(level, message)` y decidieron reemplazarlo por `logInfo`, `logWarning`, `logError`, `logDebug` (más expresivos), entonces:
- Mantienen `log()` funcionando en la versión final
- Lo marcan con `@deprecated Use logInfo/logWarning/logError/logDebug instead`
- Emiten `console.warn` la primera vez que se invoca
- Documentan la migración en `MIGRATION.md`
- Anuncian en el `CHANGELOG.md` que se eliminará en la próxima MAJOR

**Rúbrica**: la ausencia total de deprecaciones (todo se elimina de golpe o nada se planea deprecar) se evalúa como incumplimiento del RF-09, aunque el resto del paquete funcione.

---

## 4. Arquitectura de Componentes

### 4.1 Estructura de Carpetas Sugerida

Los estudiantes deben organizar el código de forma modular y estructurada. Se sugiere una organización similar a:

```
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

### 4.2 Componentes a Diseñar

Los estudiantes deben identificar y diseñar los componentes necesarios para cumplir con todos los requerimientos funcionales. Como mínimo, el sistema debe incluir componentes para:

**Captura de Datos**:
- Interceptar requests HTTP entrantes
- Interceptar responses HTTP salientes
- Generar identificadores únicos
- Manejar diferentes frameworks (Express/Fastify/FastAPI)

**Persistencia**:
- Interface común para todas las estrategias de storage
- Implementación de estrategia en memoria
- Implementación de estrategia SQLite
- Implementación de estrategia PostgreSQL
- Factory para instanciar la estrategia correcta

**Monitoreo**:
- Servir la interface web
- Calcular métricas agregadas
- Implementar paginación por cursor
- Manejar autenticación
- Cache de métricas calculadas

**Configuración**:
- Cargar y parsear archivos JSON
- Validar configuración
- Proveer valores por defecto

**Utilidades**:
- Serialización de datos
- Enmascaramiento de datos sensibles
- Manejo de timestamps
- Generación de UUIDs

Los estudiantes tienen libertad para estructurar estos componentes como consideren apropiado, siempre y cuando se cumplan todos los requerimientos funcionales.

---

## 5. Requerimientos No Funcionales

### RNF-01: Performance

| Métrica | Especificación |
|---------|----------------|
| Overhead de latencia | Máximo 5ms adicionales por request |
| Tipo de logging | Asíncrono para no bloquear el event loop |
| Escrituras a BD | En batches para mejor throughput |
| Cache de métricas | Reducir tiempo de response del endpoint de monitoreo |
| Queries de BD | Deben usar índices apropiados |
| Interface web | Carga inicial < 2 segundos |

### RNF-02: Confiabilidad

| Aspecto | Especificación |
|---------|----------------|
| Aislamiento de errores | Errores del paquete no deben detener la aplicación principal |
| Manejo de fallos | Graceful handling de fallos de base de datos |
| Fallback | A estrategias más simples si hay errores críticos |
| Logging interno | Errores del propio paquete deben loggearse |
| Recuperación | Automática de conexiones perdidas |
| Queue overflow | Manejo cuando la cola de logging se llena |

### RNF-03: Mantenibilidad

| Aspecto | Especificación |
|---------|----------------|
| Estilo de código | Seguir guías de estilo del lenguaje seleccionado |
| Comentarios | En funciones y componentes complejos |
| Nombres | Descriptivos de variables y funciones |
| Modularidad | Estructura clara y separación de concerns |
| Tests unitarios | Con **Vitest**, cobertura mínima 70% en componentes core (ver RF-07) |
| Tests de componentes UI | Con **Playwright Component Testing** para los organismos (ver RF-07) |
| Versionado | Semantic Versioning 2.0.0 con `CHANGELOG.md` en formato Keep a Changelog (ver RF-08) |
| Deprecación | Al menos un elemento deprecado documentado en `MIGRATION.md` (ver RF-09) |
| CI/CD (recomendado) | Pipeline que ejecute tests unitarios + component tests en cada PR |

### RNF-04: Documentación

| Documento | Contenido Requerido |
|-----------|---------------------|
| README.md | Instalación, configuración básica, quick start |
| CONFIGURATION.md | Todas las opciones de configuración con ejemplos |
| ARCHITECTURE.md | Diseño de componentes y decisiones de arquitectura |
| API.md | Documentación de endpoints de monitoreo |
| Comentarios en código | JSDoc/docstrings en funciones públicas |
| Ejemplos | Proyectos funcionales para cada framework |

### RNF-05: Seguridad

| Aspecto | Especificación |
|---------|----------------|
| Headers sensibles | Enmascaramiento automático de authorization, cookies, etc. |
| Passwords | No almacenar passwords en request bodies |
| Autenticación | En endpoint de monitoreo para producción |
| Sanitización | De datos antes de almacenar |
| SQL Injection | Uso de prepared statements en PostgreSQL |
| Validación de inputs | De toda configuración recibida |
| XSS Prevention | En interface web |

### RNF-06: Escalabilidad

| Aspecto | Especificación |
|---------|----------------|
| High-throughput | Soporte mediante batching |
| Pool de conexiones | En PostgreSQL |
| Límites de memoria | Configurables |
| Limpieza automática | De datos antiguos |
| Índices | Apropiados para queries en producción |
| Paginación eficiente | Cursor-based para grandes volúmenes |

### RNF-07: Usabilidad

| Aspecto | Especificación |
|---------|----------------|
| Instalación | Un solo comando |
| Configuración | Archivo JSON simple y bien documentado |
| Interface web | Intuitiva y fácil de navegar |
| Mensajes de error | Claros y accionables |
| Defaults sensatos | Funcionamiento out-of-the-box |
| Logging de debug | Configurable para troubleshooting |

---

## 6. Entregables del Proyecto

### 6.1 Código Fuente

| Entregable | Especificación |
|------------|----------------|
| Repositorio Git | Con historial de commits significativos |
| Estructura de carpetas | Según especificación del documento |
| Implementación completa | Todos los componentes requeridos |
| Tests unitarios | Mínimo para componentes core |
| Tests de integración | Con los frameworks soportados |

### 6.2 Paquete Publicado

| Aspecto | Especificación |
|---------|----------------|
| Registro | NPM, PyPI o GitHub Packages |
| Versión inicial | Coherente con Semantic Versioning 2.0.0 (ver RF-09) |
| Metadata completa | Nombre, descripción, keywords (≥4), licencia, repository, bugs, homepage, engines/python_requires |
| Dependencias | Correctamente declaradas y separadas entre runtime y desarrollo |
| Scripts | De instalación, tests unitarios (`test`), y tests de componentes (`test-ct`) |
| Publicación | Al menos una versión pública instalable por otro equipo desde el registro |

### 6.3 Documentación

| Documento | Contenido |
|-----------|-----------|
| README.md | Descripción, instalación, quick start, configuración básica, enlaces |
| INSTALLATION.md | Proceso detallado de instalación |
| CONFIGURATION.md | Todas las opciones con ejemplos |
| ARCHITECTURE.md | Explicación de componentes y diseño |
| API.md | Documentación de endpoints de monitoreo |
| Carpeta examples/ | Proyectos funcionales por framework |

### 6.4 Interface Web

| Componente | Especificación |
|------------|----------------|
| Archivo HTML | Interface completa embebida |
| Dashboard | Con métricas y gráficos |
| Lista de requests | Con filtros y paginación |
| Vista de detalle | Información completa de cada request |
| Responsive | Funcional en desktop y mobile |

### 6.5 Aplicación de Demostración

| Componente | Descripción |
|------------|-------------|
| Aplicación ejemplo | Usando el paquete logger |
| Endpoints de prueba | Para generar requests variadas |
| Demostración de estrategias | Las 3 estrategias de storage |
| Script de carga | Para generar tráfico de prueba |
| Instrucciones | Para ejecutar la demo |

### 6.6 Presentación

| Aspecto | Contenido |
|---------|-----------|
| Arquitectura | Explicación de componentes, decisiones de diseño y trade-offs asumidos |
| Demo en vivo | Funcionamiento del paquete instalado en un proyecto de prueba |
| Comparación | De estrategias de persistencia y cuándo usar cada una |
| Métricas | De performance y capacidad |
| Interface | Navegación por la web interface |
| Estrategia de testing | Explicar por qué cada test vive donde vive (Vitest para lógica, Playwright CT para UI real) |
| Versionado y CHANGELOG | Recorrido por el historial de versiones, categorías SemVer aplicadas |
| Deprecación | Presentación del elemento deprecado, el `console.warn` en acción, y el `MIGRATION.md` |
| Q&A | Respuestas a preguntas técnicas |

### 6.7 Entregables de Mantenimiento

| Entregable | Especificación |
|------------|----------------|
| `CHANGELOG.md` | En formato Keep a Changelog, en la raíz del repositorio, con al menos dos releases documentados |
| `MIGRATION.md` | Documenta la deprecación exigida por RF-09, con código antes/después y motivo |
| `TESTING.md` | Explica la estrategia de testing del equipo, qué se testea con Vitest y qué con Playwright CT, y cómo correr cada suite |
| `.env.example` | Archivo de ejemplo con las variables de entorno esperadas por el paquete, sin valores reales |
| Reporte de coverage | Salida de `vitest --coverage` incluida en el repositorio o en el README como evidencia |
| Archivos `*.test.*` | Tests unitarios en Vitest para los componentes core del paquete |
| Archivos `*.spec.*` | Tests de componentes con Playwright CT para los componentes principales de la UI |

---

## 7. Criterios de Éxito del Proyecto

### Funcional

| Criterio | Validación |
|----------|-----------|
| Instalación | Funciona con un único comando |
| Middleware | Captura todas las requests/responses correctamente |
| Endpoint de monitoreo | Sirve interface web funcional |
| API de métricas | Retorna métricas correctas y actualizadas |
| API de requests | Paginación por cursor funciona correctamente |
| Vista de detalle | Muestra información completa de cada request |
| Tres estrategias de storage | Memory, SQLite y PostgreSQL funcionan |
| Configuración JSON | Todas las opciones son respetadas |
| Filtros | Búsqueda y filtrado funcionan en la interface |

### Técnico

| Criterio | Validación |
|----------|-----------|
| Arquitectura | Basada en componentes bien delimitados y con responsabilidades claras |
| Componentes | Desacoplados y modulares |
| Interfaces | Bien definidas y consistentes |
| Código | Limpio y documentado |
| Performance | Overhead < 5ms por request |
| Paginación | Eficiente para grandes volúmenes |
| Interface responsive | Funcional en todos los dispositivos |
| Testing con Vitest | Cobertura mínima del 70% en componentes core |
| Component testing con Playwright CT | Componentes principales de la UI cubiertos |
| SemVer + CHANGELOG | Historial coherente, cambios categorizados correctamente |
| Deprecación demostrada | Elemento deprecado + `@deprecated` + `console.warn` + `MIGRATION.md` |
| Secrets vía `.env` | Sin credenciales en texto plano en el `logger.config.json` |

### Entregables

| Criterio | Validación |
|----------|-----------|
| Paquete | Publicado y accesible |
| Documentación | Completa y clara |
| Ejemplos | Funcionales para cada framework |
| Demo | Ejecutable y representativa |
| Presentación | Técnica y bien estructurada |
| Interface web | Intuitiva y funcional |

---

## 8. Recursos de Referencia

### Documentación de Frameworks
- Express Middleware: https://expressjs.com/en/guide/writing-middleware.html
- Fastify Hooks: https://www.fastify.io/docs/latest/Reference/Hooks/
- FastAPI Middleware: https://fastapi.tiangolo.com/tutorial/middleware/

### Bases de Datos
- SQLite Node (better-sqlite3): https://github.com/WiseLibs/better-sqlite3
- SQLite Python: https://docs.python.org/3/library/sqlite3.html
- PostgreSQL Node (pg): https://node-postgres.com/
- PostgreSQL Python (psycopg2): https://www.psycopg.org/docs/

### Publicación de Paquetes
- Publishing to NPM: https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages
- Publishing to PyPI: https://packaging.python.org/tutorials/packaging-projects/
- GitHub Packages: https://docs.github.com/en/packages

### Testing y mantenimiento
- Vitest: https://vitest.dev/guide/
- Testing Library: https://testing-library.com
- Dodds, K. C. (2018). Testing Implementation Details: https://kentcdodds.com/blog/testing-implementation-details
- Playwright Component Testing: https://playwright.dev/docs/test-components
- Semantic Versioning 2.0.0: https://semver.org/spec/v2.0.0.html
- Keep a Changelog: https://keepachangelog.com
- MUI Migration Guide v4→v5 (ejemplo de deprecación en producción): https://mui.com/material-ui/migration/migration-v4/

### Manejo de secrets y variables de entorno
- dotenv (Node.js): https://github.com/motdotla/dotenv
- python-dotenv: https://github.com/theskumar/python-dotenv
- The Twelve-Factor App · Config: https://12factor.net/config

---
