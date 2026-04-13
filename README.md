# MERO — Medición de Eficiencia y Rendimiento Operativo

Sistema de productividad en planta: asigna empleados (QR) a subtareas, captura producción por hora y calcula eficiencia en tiempo real contra estándares.

---

## Referencia rápida

```bash
pnpm mero:up                # levantar app (db + api + web + nginx)
pnpm mero:down              # bajar app (tunnel NO se toca)
pnpm mero:deploy            # pull origin/main + deploy selectivo (Prisma condicional)
pnpm mero:deploy:full       # pull origin/main + rebuild completo
pnpm mero:rebuild:api       # rebuild solo API (~60s)
pnpm mero:rebuild:web       # rebuild solo Web

pnpm mero:tunnel:up         # levantar cloudflared (solo en instalación)
pnpm mero:tunnel:down       # bajar cloudflared (CUIDADO: baja Cloudflare)

pnpm mero:studio            # abrir Prisma Studio en el browser
pnpm mero:logs              # logs de todos los servicios
pnpm mero:logs:api          # logs solo del API

pnpm mero:seed:estandares   # cargar 429 estándares de producción
pnpm mero:backup            # backup de PostgreSQL
```

> En el NAS con `make` instalado, todos los comandos equivalen a `make <comando>` sin el prefijo `mero:`.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | NestJS 10 (TypeScript, modular) |
| Frontend | Express + EJS (server-side rendering) |
| Base de datos | PostgreSQL 16 |
| ORM | Prisma 5 |
| Realtime | SSE (Server-Sent Events) |
| Infra | Docker Compose + Nginx |
| Monorepo | pnpm workspaces |
| Tunnel | Cloudflare Tunnel |
| ERP externo | VITA (red `erp_erp_network`) |

---

## Estructura del proyecto

```
MERO/
├── apps/
│   ├── api/               NestJS backend (API REST + SSE)
│   │   ├── src/           Módulos: auth, usuarios, empleados, asignaciones,
│   │   │                           capturas, metricas, catalogos, auditoria
│   │   └── prisma/        Schema y migraciones
│   └── web/               Express + EJS frontend (roles: ADMIN, ENCARGADO, CONSULTOR)
├── packages/
│   └── shared/            Tipos y enums compartidos
├── infra/
│   └── docker/
│       ├── docker-compose.yml        App stack (db, api, web, nginx)
│       ├── docker-compose.tunnel.yml Cloudflare tunnel (stack separado)
│       ├── Dockerfile                API multi-stage
│       ├── Dockerfile.web            Web multi-stage
│       ├── entrypoint.sh             Startup API (migraciones + arranque)
│       └── nginx/nginx.conf          Reverse proxy
├── scripts/
│   ├── backup_pg.sh       Backup PostgreSQL (gzip, retención 30 días)
│   ├── restore_pg.sh      Restaurar backup
│   └── sql/
│       └── seed_estandares.sql  429 estándares (33 subtareas × 13 modelos)
├── docs/
│   ├── ARCHITECTURE.txt
│   ├── API_CONTRACTS.txt
│   └── RUNBOOK.txt
└── Makefile               Comandos alternativos (Linux / NAS)
```

---

## Primera instalación (NAS o servidor nuevo)

### Requisitos

- Docker Engine + Compose v2
- Node.js v20+ y pnpm v9+
- Git

```bash
docker --version        # 24+
docker compose version  # 2+
node --version          # v20+
pnpm --version          # v9+
```

### Pasos

```bash
# 1. Clonar
git clone https://github.com/BzSaur/MERO
cd MERO

# 2. Instalar dependencias
pnpm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env: cambiar JWT_SECRET, JWT_REFRESH_SECRET, y credenciales VITA

# 4. Crear la red de VITA (si VITA no está corriendo aún)
docker network create erp_erp_network 2>/dev/null || true

# 5. Levantar cloudflared (una sola vez, nunca se vuelve a tocar)
pnpm mero:tunnel:up

# 6. Levantar app
pnpm mero:up

# 7. Ejecutar seed inicial (solo primera vez)
pnpm db:seed

# 8. Verificar que todo está healthy
docker ps

# 9. Cargar estándares de producción
pnpm mero:seed:estandares
```

### Accesos post-instalación

| URL | Descripción |
|-----|-------------|
| `http://localhost:8080` | Web via nginx |
| `http://localhost:4000` | Web directo |
| `http://localhost:3002/api` | API REST |
| Cloudflare domain | Acceso externo (ver `.env` → `CLOUDFLARE_TUNNEL_TOKEN`) |

---

## Deploy normal (actualización de código)

```bash
# En el NAS, después de hacer push desde desarrollo:
pnpm mero:deploy
# → git pull origin main
# → si cambió Prisma: migrate deploy + generate
# → rebuild selectivo de servicios tocados
# → cloudflared NO se toca, sigue corriendo
```

### Reconstruir solo un servicio

```bash
pnpm mero:rebuild:api   # ~60-90s, web y tunnel no se interrumpen
pnpm mero:rebuild:web   # ~30s
```

### Bajar y volver a levantar (downtime ~3 min, tunnel sobrevive)

```bash
pnpm mero:down          # baja db, api, web, nginx — cloudflared SIGUE corriendo
pnpm mero:up            # levanta todo de nuevo
# Cloudflare reconecta automáticamente cuando nginx vuelve
```

---

## Desarrollo local

Para trabajar con hot reload. La DB corre en Docker, la API y web en local.

### Requisitos adicionales

- Node.js v20+
- pnpm v9+

### Setup

```bash
# 1. Instalar dependencias
pnpm install

# 2. Copiar .env si no existe
cp .env.example .env

# 3. Levantar solo la DB
docker compose -f infra/docker/docker-compose.yml up db -d

# 4. Generar cliente Prisma
pnpm db:generate

# 5. Correr migraciones
pnpm db:migrate

# 6. Seed inicial
pnpm db:seed

# 7. En terminal 1: API con hot reload
pnpm dev

# 8. En terminal 2: Web con hot reload
pnpm dev:web
```

API en `http://localhost:3000/api` — Web en `http://localhost:4000`

---

## Prisma

### Abrir Prisma Studio (inspector visual de la DB)

```bash
# Requiere que la DB esté corriendo
pnpm mero:studio
# Abre en http://localhost:5555
```

> No necesitas navegar a ninguna carpeta. Lee el `.env` de la raíz automáticamente.

### Crear una migración nueva (desarrollo)

```bash
pnpm db:migrate
# Pide nombre para la migración, genera el SQL y lo aplica
```

### Aplicar migraciones en producción (dentro del contenedor)

```bash
docker exec mero-api sh -c "cd /app/apps/api && npx prisma migrate deploy"
```

> En producción las migraciones se aplican **automáticamente** al iniciar el contenedor.

### Regenerar cliente Prisma (después de cambiar schema.prisma)

```bash
pnpm db:generate
```

---

## Seeds

### Seed inicial (áreas, subtareas, modelos, usuario admin)

Se ejecuta automáticamente en la primera instalación. Para re-ejecutarlo:

```bash
pnpm db:seed
# Es idempotente (upsert)
```

### Seed de estándares de producción (429 registros)

```bash
pnpm mero:seed:estandares
# Aplica scripts/sql/seed_estandares.sql directamente en la DB
# Es idempotente: borra y re-inserta los registros del 2026-04-10
```

Cubre 33 subtareas × 13 modelos. Valores notables con variación por modelo:

| Subtarea | Excepción |
|----------|-----------|
| Desolde | V5=25, V5 Small=40, resto=20 |
| Desensamble de Tarjeta | ZTE=20, resto=35 |
| Limpieza de Tarjeta | Fiberhome=25, X6=10, resto=20 |
| Lijado Tapa | V5/V5 Small/X6=22.5, resto=12 |
| Liberación Tapa | V5=30, resto=25 |
| Base (id 29) | V5=35, resto=40 |
| Base (id 32) | Fiberhome=30, resto=40 |
| Impresión Etiqueta | Fiberhome=60, resto=50 |

---

## Cloudflare Tunnel

El tunnel corre en un stack Docker independiente y sobrevive cualquier rebuild del app stack.

```bash
# Instalar (primera vez)
pnpm mero:tunnel:up

# Reiniciar si hay problemas
pnpm mero:tunnel:restart

# Ver estado
docker logs mero-cloudflared

# Bajar (CUIDADO: desconecta acceso externo)
pnpm mero:tunnel:down
```

El token se lee de `CLOUDFLARE_TUNNEL_TOKEN` en `.env`.

---

## Backups

```bash
# Crear backup (gzip, guardado en infra/docker/backups/)
pnpm mero:backup

# Restaurar
pnpm mero:restore
# Editar scripts/restore_pg.sh para apuntar al archivo correcto
```

Los backups se retienen 30 días automáticamente.

---

## Variables de entorno

Editar `.env` en la raíz. El archivo `.env.example` tiene todos los defaults.

| Variable | Descripción | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Conexión Prisma | `postgresql://mero:mero_secret@localhost:5433/mero_db` |
| `POSTGRES_USER` | Usuario PostgreSQL | `mero` |
| `POSTGRES_PASSWORD` | Password PostgreSQL | `mero_secret` |
| `POSTGRES_DB` | Nombre de la DB | `mero_db` |
| `DB_PORT` | Puerto expuesto | `5433` (5432 lo usa VITA) |
| `JWT_SECRET` | Secreto access token | **Cambiar en producción** |
| `JWT_EXPIRES_IN` | Duración access token | `8h` |
| `JWT_REFRESH_SECRET` | Secreto refresh token | **Cambiar en producción** |
| `JWT_REFRESH_EXPIRES_IN` | Duración refresh token | `7d` |
| `API_PORT` | Puerto externo API | `3002` |
| `WEB_PORT` | Puerto externo Web | `4000` |
| `API_URL` | URL interna API (para web) | `http://localhost:3000/api` |
| `WEB_SESSION_COOKIE_SECURE` | Cookie de sesión web (`true`/`false`/`auto`) | `auto` |
| `CORS_ORIGIN` | Origen CORS permitido | `http://localhost:4000` |
| `VITA_DB_HOST` | Host de DB VITA | — |
| `VITA_DB_PORT` | Puerto DB VITA | `5432` |
| `VITA_DB_USER` | Usuario DB VITA | — |
| `VITA_DB_PASSWORD` | Password DB VITA | — |
| `VITA_DB_NAME` | Nombre DB VITA | — |
| `CLOUDFLARE_TUNNEL_TOKEN` | Token del tunnel | — |
| `LOG_LEVEL` | Nivel de logging | `info` |

---

## Credenciales por defecto

Después de ejecutar el seed inicial:

| Email | Password | Rol |
|-------|----------|-----|
| `mario.martinez@ramelectronics.com` | `Mero#2024` | ADMIN |
| `f.alarcon@ramelectronics.com.mx` | `Mero#2024` | ADMIN |
| `admin@mero.local` | `admin1234` | ADMIN |

Definidas en `apps/api/src/seed.ts`.

---

## Puertos

| Contenedor | Puerto interno | Puerto externo | Descripción |
|-----------|---------------|----------------|-------------|
| `mero-db` | 5432 | 5433 | PostgreSQL |
| `mero-api` | 3000 | 3002 | NestJS API |
| `mero-web` | 4000 | 4000 | Express Web |
| `mero-nginx` | 80 | 8080 | Reverse proxy MERO |
| `mero-nginx` | 8080 | 8081 | Proxy VITA |
| `mero-cloudflared` | — | — | Tunnel (network_mode: host) |

---

## Solución de problemas

**"network erp_erp_network declared as external, but could not be found"**
```bash
docker network create erp_erp_network
```

**"Environment variable not found: DATABASE_URL" al correr Prisma manualmente**
Siempre ejecutar desde la raíz del repo con los scripts de pnpm:
```bash
pnpm mero:studio
pnpm db:migrate
pnpm db:generate
```

**La API no arranca (healthcheck failing)**
```bash
pnpm mero:logs:api
# Buscar errores de conexión a DB o migraciones fallidas
```

**Seed falla con "duplicate key"**
El seed usa upsert, no debería fallar. Revisar con Prisma Studio:
```bash
pnpm mero:studio
```

**Cloudflared no conecta**
```bash
docker logs mero-cloudflared
# Verificar CLOUDFLARE_TUNNEL_TOKEN en .env
pnpm mero:tunnel:restart
```

**Reset completo de DB (DESTRUYE TODOS LOS DATOS)**
```bash
pnpm mero:down
docker volume rm mero_pgdata
pnpm mero:up
pnpm db:seed
pnpm mero:seed:estandares
```

---

## Documentación adicional

- [Arquitectura](docs/ARCHITECTURE.txt)
- [Contratos API](docs/API_CONTRACTS.txt)
- [Runbook](docs/RUNBOOK.txt)
