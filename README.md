# MERO

Medicion de Eficiencia y Rendimiento Operativo

Sistema de medicion de productividad en planta. Asigna empleados (QR) a subtareas y captura produccion por hora para calcular eficiencia en tiempo real vs estandares.

## Stack

- **Backend:** NestJS (monolito modular, TypeScript)
- **Frontend:** Express + EJS (server-side rendering)
- **Base de datos:** PostgreSQL 16
- **ORM:** Prisma
- **Realtime:** SSE (Server-Sent Events)
- **Infra:** Docker Compose + Nginx
- **Monorepo:** pnpm workspaces

## Estructura del proyecto

```
/apps/api          NestJS backend (API REST + SSE)
/apps/web          Express + EJS frontend
/packages/shared   Tipos, enums y constantes compartidas
/infra/docker      Docker Compose, Dockerfiles, Nginx
/db                Seeds y notas de esquema
/docs              Arquitectura, contratos API, Runbook
/scripts           Backup y restore de PostgreSQL
```

---

## Opcion A: Levantar todo con Docker (recomendado)

Esta opcion levanta los 4 servicios (db, api, web, nginx) en contenedores. No necesitas instalar Node.js ni pnpm en tu maquina.

### Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac) o Docker Engine + Compose (Linux)

```bash
docker --version           # v24+
docker compose version     # v2+
```

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/BzSaur/MERO
cd MERO

# 2. Crear archivo de variables de entorno
cp .env.example .env
# Editar .env y cambiar JWT_SECRET y JWT_REFRESH_SECRET por valores seguros

# 3. Construir y levantar todos los contenedores
docker compose -f infra/docker/docker-compose.yml up --build -d

# 4. Verificar que los 4 contenedores estan corriendo
docker ps
```

Deberias ver:

| Contenedor   | Puerto  | Descripcion                    |
|--------------|---------|--------------------------------|
| `mero-db`    | 5433    | PostgreSQL 16                  |
| `mero-api`   | 3000    | NestJS API                     |
| `mero-web`   | 4000    | Express + EJS frontend         |
| `mero-nginx` | 80      | Reverse proxy (web + api)      |

```bash
# 5. Ver logs del API (las migraciones se ejecutan automaticamente)
docker logs mero-api

# 6. Sembrar datos iniciales
docker exec mero-api sh -c "cd apps/api && npx prisma db seed"

# 7. Abrir en el navegador
# http://localhost        (via nginx)
# http://localhost:4000   (web directo)
```

### Comandos Docker utiles

```bash
# Detener todos los contenedores
docker compose -f infra/docker/docker-compose.yml down

# Detener y borrar volumenes (reset completo de DB)
docker compose -f infra/docker/docker-compose.yml down -v

# Reconstruir despues de cambios en el codigo
docker compose -f infra/docker/docker-compose.yml up --build -d

# Ver logs en tiempo real
docker logs -f mero-api
docker logs -f mero-web
```

---

## Opcion B: Desarrollo local (solo DB en Docker)

Para desarrollo activo donde necesitas hot reload.

### Requisitos

- Node.js v20+ ([descargar](https://nodejs.org/))
- pnpm v9+ (`npm install -g pnpm`)
- Docker (solo para PostgreSQL)
- Git

```bash
node --version    # v20+
pnpm --version    # v9+
docker --version  # v24+
```

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/BzSaur/MERO
cd MERO

# 2. Instalar dependencias
pnpm install

# 3. Configurar variables de entorno
cp .env.example .env

# 4. Levantar solo PostgreSQL
docker compose -f infra/docker/docker-compose.yml up db -d

# 5. Compilar paquete compartido
pnpm --filter @mero/shared build

# 6. Generar cliente Prisma
pnpm db:generate

# 7. Ejecutar migraciones
pnpm db:migrate

# 8. Cargar datos iniciales
pnpm db:seed

# 9. Iniciar API (terminal 1)
pnpm dev:api

# 10. Iniciar Web (terminal 2)
pnpm dev:web
```

La web estara en **http://localhost:4000** y la API en **http://localhost:3000/api**.

---

## Variables de entorno

| Variable            | Descripcion                     | Valor por defecto                                      |
|---------------------|---------------------------------|--------------------------------------------------------|
| `DATABASE_URL`      | Conexion a PostgreSQL           | `postgresql://mero:mero_secret@localhost:5433/mero_db` |
| `POSTGRES_USER`     | Usuario de PostgreSQL           | `mero`                                                 |
| `POSTGRES_PASSWORD` | Password de PostgreSQL          | `mero_secret`                                          |
| `POSTGRES_DB`       | Nombre de la base de datos      | `mero_db`                                              |
| `DB_PORT`           | Puerto expuesto de PostgreSQL   | `5433`                                                 |
| `JWT_SECRET`        | Secreto para tokens JWT         | Cambiar en produccion                                  |
| `JWT_EXPIRES_IN`    | Duracion del access token       | `8h`                                                   |
| `API_PORT`          | Puerto de la API                | `3000`                                                 |
| `WEB_PORT`          | Puerto del frontend             | `4000`                                                 |
| `API_URL`           | URL interna de la API           | `http://localhost:3000/api`                             |
| `CORS_ORIGIN`       | Origen permitido para CORS      | `http://localhost:4000`                                 |

---

## Credenciales por defecto

Despues de ejecutar el seed, puedes iniciar sesion con:

| Email                        | Password    | Rol        |
|------------------------------|-------------|------------|
| `mario.martinez@empresa.com` | `Mero#2024` | ADMIN      |
| `fernando.alarcon@empresa.com`| `Mero#2024`| ADMIN      |
| `admin@mero.local`           | `admin1234` | ADMIN      |

Ver todos los usuarios en `db/seed/seed_usuarios.ts`.

---

## Comandos utiles

| Comando                | Descripcion                                    |
|------------------------|------------------------------------------------|
| `pnpm dev:api`         | Iniciar API en modo desarrollo (hot reload)    |
| `pnpm dev:web`         | Iniciar Web en modo desarrollo (hot reload)    |
| `pnpm build`           | Compilar el proyecto para produccion           |
| `pnpm db:generate`     | Regenerar cliente de Prisma                    |
| `pnpm db:migrate`      | Ejecutar migraciones pendientes                |
| `pnpm db:seed`         | Cargar datos iniciales                         |
| `pnpm db:seed:usuarios`| Cargar usuarios de produccion                  |

---

## Probar la API

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"mario.martinez@empresa.com\", \"password\": \"Mero#2024\"}"
```

---

## Solucion de problemas

**"pnpm: command not found"**
Instalar pnpm: `npm install -g pnpm`

**"docker: command not found"**
Instalar Docker Desktop y asegurarse de que este corriendo.

**"connect ECONNREFUSED 127.0.0.1:5433"**
La base de datos no esta levantada. Ejecutar `docker compose -f infra/docker/docker-compose.yml up db -d`.

**"P1001: Can't reach database server"**
Verificar que el contenedor `mero-db` este corriendo: `docker ps`.

**El API no arranca en Docker**
Revisar logs: `docker logs mero-api`. Las migraciones se ejecutan automaticamente al iniciar.

**Error en migraciones**
Resetear la base de datos:
```bash
cd apps/api && npx prisma migrate reset
```

---

## Documentacion

- [Arquitectura](docs/ARCHITECTURE.txt)
- [Contratos API](docs/API_CONTRACTS.txt)
- [Runbook](docs/RUNBOOK.txt)
