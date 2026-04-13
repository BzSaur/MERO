COMPOSE        = docker compose -f infra/docker/docker-compose.yml
COMPOSE_TUNNEL = docker compose -f infra/docker/docker-compose.tunnel.yml
API_C          = mero-api
DB_C           = mero-db

.PHONY: help \
        up up-seed down restart logs logs-api logs-web \
        tunnel-up tunnel-down tunnel-restart \
        rebuild-api rebuild-web deploy \
        studio migrate migrate-deploy seed generate \
        backup restore network-init \
        dev dev-web

help: ## Mostrar esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*##"}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ─── Red ─────────────────────────────────────────────────────────────────────

network-init: ## Crear vita_network si no existe (primera vez)
	docker network inspect erp_erp_network >/dev/null 2>&1 || docker network create erp_erp_network

# ─── App stack ────────────────────────────────────────────────────────────────

up: network-init ## Levantar app stack (db, api, web, nginx)
	$(COMPOSE) up -d

up-seed: network-init ## Levantar con seed (primera instalación)
	RUN_SEED=true $(COMPOSE) up -d

down: ## Detener app stack (tunnel sigue corriendo)
	$(COMPOSE) down

restart: ## Reiniciar app stack
	$(COMPOSE) restart

logs: ## Logs de todos los servicios (follow)
	$(COMPOSE) logs -f

logs-api: ## Logs del API
	docker logs -f $(API_C)

logs-web: ## Logs del Web
	docker logs -f mero-web

# ─── Rebuild individual ───────────────────────────────────────────────────────

rebuild-api: ## Rebuild y reiniciar solo la API (tunnel no se toca)
	$(COMPOSE) up -d --build --no-deps api

rebuild-web: ## Rebuild y reiniciar solo el Web
	$(COMPOSE) up -d --build --no-deps web

deploy: ## Git pull + rebuild de lo que cambió (tunnel no se toca)
	git -C . pull
	$(COMPOSE) up -d --build

# ─── Tunnel (tocar solo en instalación o emergencias) ─────────────────────────

tunnel-up: ## Levantar cloudflared tunnel (persiste entre deploys)
	$(COMPOSE_TUNNEL) --env-file .env up -d

tunnel-down: ## Detener cloudflared tunnel (CUIDADO: baja Cloudflare)
	$(COMPOSE_TUNNEL) down

tunnel-restart: ## Reiniciar solo cloudflared
	$(COMPOSE_TUNNEL) restart

# ─── Prisma / Base de datos ───────────────────────────────────────────────────

studio: ## Abrir Prisma Studio (requiere DB corriendo)
	npx dotenv -e .env -- npx prisma studio --schema apps/api/prisma/schema.prisma

migrate: ## Crear migración nueva (desarrollo local)
	pnpm db:migrate

migrate-deploy: ## Aplicar migraciones en contenedor
	docker exec $(API_C) sh -c "cd /app/apps/api && npx prisma migrate deploy"

seed: ## Ejecutar seed en contenedor
	docker exec $(API_C) sh -c "cd /app/apps/api && npx prisma db seed"

seed-estandares: ## Cargar estándares de producción (429 registros, idempotente)
	docker exec -i $(DB_C) psql -U $${POSTGRES_USER:-mero} $${POSTGRES_DB:-mero_db} \
	  < scripts/sql/seed_estandares.sql

generate: ## Regenerar cliente Prisma
	pnpm db:generate

# ─── Backups ──────────────────────────────────────────────────────────────────

backup: ## Backup de PostgreSQL
	./scripts/backup_pg.sh

restore: ## Restaurar backup (uso: make restore FILE=./backups/xxx.sql.gz)
	./scripts/restore_pg.sh $(FILE)

# ─── Desarrollo local ─────────────────────────────────────────────────────────

dev: ## API en modo desarrollo (hot reload)
	pnpm dev

dev-web: ## Web en modo desarrollo (hot reload)
	pnpm dev:web
