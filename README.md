# MERO

Medición de Eficiencia y Rendimiento Operativo

Sistema de medición de productividad en planta. Asigna empleados (QR) a subtareas y captura producción por hora para calcular eficiencia en tiempo real vs estándares.

## Stack

- **Backend:** NestJS (monolito modular, TypeScript)
- **Base de datos:** PostgreSQL 16
- **ORM:** Prisma
- **Realtime:** SSE (Server-Sent Events)
- **Infra:** Docker Compose + Nginx
- **Monorepo:** pnpm workspaces

## Estructura del proyecto

```
/apps/api          NestJS backend (API REST + SSE)
/packages/shared   Tipos, enums y constantes compartidas
/infra/docker      Docker Compose, Dockerfile, Nginx
/db                Seeds y notas de esquema
/docs              Arquitectura, contratos API, Runbook
/scripts           Backup y restore de PostgreSQL
```

---

## Requisitos previos

Antes de comenzar, asegúrate de tener instalado lo siguiente:

### 1. Node.js (v20 o superior)

Descargar e instalar desde: https://nodejs.org/

Verificar instalación:

```bash
node --version   # Debe mostrar v20.x.x o superior
```

### 2. pnpm (v9 o superior)

pnpm es el gestor de paquetes que usa este proyecto. Instalar globalmente:

```bash
npm install -g pnpm
```

Verificar instalación:

```bash
pnpm --version   # Debe mostrar 9.x.x o superior
```

### 3. Docker y Docker Compose

Necesario para levantar PostgreSQL y Nginx.

- **Windows:** Instalar [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- **Linux:** Instalar [Docker Engine](https://docs.docker.com/engine/install/) y [Docker Compose](https://docs.docker.com/compose/install/)

Verificar instalación:

```bash
docker --version           # Debe mostrar Docker version 24.x o superior
docker compose version     # Debe mostrar Docker Compose version v2.x
```

### 4. Git

Descargar desde: https://git-scm.com/

```bash
git --version
```

---

## Instalación paso a paso

### Paso 1 — Clonar el repositorio

```bash
git clone https://github.com/BzSaur/MERO
cd MERO
```

### Paso 2 — Instalar dependencias

```bash
pnpm install
```

Esto instala las dependencias de todos los workspaces (`apps/api`, `packages/shared`).

### Paso 3 — Configurar variables de entorno

```bash
cp .env.example .env
```

Abrir el archivo `.env` y ajustar los valores según tu entorno. Los valores por defecto funcionan para desarrollo local:

| Variable            | Descripción                          | Valor por defecto             |
|---------------------|--------------------------------------|-------------------------------|
| `DATABASE_URL`      | Conexión a PostgreSQL                | `postgresql://mero:mero_secret@localhost:5432/mero_db` |
| `POSTGRES_USER`     | Usuario de PostgreSQL                | `mero`                        |
| `POSTGRES_PASSWORD` | Contraseña de PostgreSQL             | `mero_secret`                 |
| `POSTGRES_DB`       | Nombre de la base de datos           | `mero_db`                     |
| `JWT_SECRET`        | Secreto para tokens JWT              | Cambiar en producción         |
| `JWT_EXPIRES_IN`    | Duración del access token            | `8h`                          |
| `API_PORT`          | Puerto de la API                     | `3000`                        |
| `CORS_ORIGIN`       | Origen permitido para CORS           | `http://localhost:5173`       |

### Paso 4 — Levantar la base de datos

```bash
pnpm docker:up
```

Esto levanta los contenedores de PostgreSQL y Nginx. Espera unos segundos a que PostgreSQL esté listo.

Para verificar que los contenedores están corriendo:

```bash
docker ps
```

Deberías ver `mero-db` y `mero-nginx` en estado `Up`.

### Paso 5 — Generar el cliente de Prisma

```bash
pnpm db:generate
```

### Paso 6 — Ejecutar migraciones de base de datos

```bash
pnpm db:migrate
```

Esto crea todas las tablas en PostgreSQL según el esquema definido en `apps/api/prisma/schema.prisma`.

### Paso 7 — Cargar datos iniciales (seed)

```bash
pnpm db:seed
```

Esto crea:
- 3 áreas (Corte, Costura, Empaque)
- 6 subtareas
- 2 modelos/SKU de ejemplo
- 8 estándares de producción
- 5 empleados de demo
- 1 usuario admin (`admin@mero.local` / `admin1234`)

### Paso 8 — Iniciar el servidor en modo desarrollo

```bash
pnpm dev
```

La API estará disponible en: **http://localhost:3000/api**

---

## Comandos útiles

| Comando              | Descripción                                    |
|----------------------|------------------------------------------------|
| `pnpm dev`           | Iniciar API en modo desarrollo (hot reload)    |
| `pnpm build`         | Compilar el proyecto para producción           |
| `pnpm start`         | Iniciar en modo producción (requiere build)    |
| `pnpm db:generate`   | Regenerar cliente de Prisma                    |
| `pnpm db:migrate`    | Ejecutar migraciones pendientes                |
| `pnpm db:seed`       | Cargar datos iniciales                         |
| `pnpm docker:up`     | Levantar contenedores (DB + Nginx)             |
| `pnpm docker:down`   | Detener contenedores                           |

---

## Probar la API

Una vez levantado el servidor, puedes probar el login:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@mero.local", "password": "admin1234"}'
```

La respuesta incluirá un `accessToken` que debes usar como `Bearer` en las demás peticiones:

```bash
curl http://localhost:3000/api/catalogos/areas \
  -H "Authorization: Bearer <tu-access-token>"
```

---

## Solución de problemas comunes

**"pnpm: command not found"**
Instalar pnpm: `npm install -g pnpm`

**"docker: command not found"**
Instalar Docker Desktop y asegurarse de que esté corriendo.

**"connect ECONNREFUSED 127.0.0.1:5432"**
La base de datos no está levantada. Ejecutar `pnpm docker:up` y esperar unos segundos.

**"P1001: Can't reach database server"**
Verificar que el contenedor `mero-db` esté corriendo: `docker ps`. Si no aparece, revisar logs: `docker logs mero-db`.

**Error en migraciones**
Si hay problemas con las migraciones, resetear la base de datos:
```bash
cd apps/api && npx prisma migrate reset
```

---

## Documentación

- [Arquitectura](docs/ARCHITECTURE.txt) — Diseño general del sistema
- [Contratos API](docs/API_CONTRACTS.txt) — Todos los endpoints documentados
- [Runbook](docs/RUNBOOK.txt) — Guía de operación y despliegue
