#!/bin/sh
# Deploy inteligente para NAS/servidor:
# - Siempre hace git pull origin main (configurable por variables)
# - Rebuild selectivo de servicios segun archivos cambiados
# - Si cambia Prisma: corre migrate deploy + generate en el contenedor API

set -eu

COMPOSE_FILE="infra/docker/docker-compose.yml"
TARGET_REMOTE="${MERO_DEPLOY_REMOTE:-origin}"
TARGET_BRANCH="${MERO_DEPLOY_BRANCH:-main}"
QR_HOST_DIR="apps/api/QR"

info() {
  echo ">> $*"
}

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

BEFORE_SHA="$(git rev-parse HEAD)"

info "Haciendo git pull ${TARGET_REMOTE} ${TARGET_BRANCH}..."
git pull "$TARGET_REMOTE" "$TARGET_BRANCH"

AFTER_SHA="$(git rev-parse HEAD)"

info "Asegurando carpeta local de QR (${QR_HOST_DIR})..."
mkdir -p "$QR_HOST_DIR"

if [ "$BEFORE_SHA" = "$AFTER_SHA" ]; then
  info "Sin commits nuevos. Verificando que el stack este arriba..."
  compose up -d
  exit 0
fi

CHANGED_FILES="$(git diff --name-only "$BEFORE_SHA" "$AFTER_SHA")"

info "Archivos cambiados desde el ultimo deploy:"
echo "$CHANGED_FILES"

NEEDS_API=0
NEEDS_WEB=0
NEEDS_NGINX=0
NEEDS_FULL=0
NEEDS_PRISMA=0

if printf '%s\n' "$CHANGED_FILES" | grep -qE '^apps/api/|^packages/shared/|^package\.json$|^pnpm-lock\.yaml$|^pnpm-workspace\.yaml$|^tsconfig\.base\.json$|^infra/docker/Dockerfile$|^infra/docker/entrypoint\.sh$'; then
  NEEDS_API=1
fi

if printf '%s\n' "$CHANGED_FILES" | grep -qE '^apps/web/|^packages/shared/|^package\.json$|^pnpm-lock\.yaml$|^pnpm-workspace\.yaml$|^infra/docker/Dockerfile\.web$'; then
  NEEDS_WEB=1
fi

if printf '%s\n' "$CHANGED_FILES" | grep -qE '^infra/docker/nginx/nginx\.conf$'; then
  NEEDS_NGINX=1
fi

if printf '%s\n' "$CHANGED_FILES" | grep -qE '^apps/api/prisma/'; then
  NEEDS_PRISMA=1
fi

if printf '%s\n' "$CHANGED_FILES" | grep -qE '^infra/docker/docker-compose\.yml$|^infra/docker/docker-compose\.tunnel\.yml$'; then
  NEEDS_FULL=1
fi

if [ "$NEEDS_FULL" -eq 1 ]; then
  info "Cambios de infraestructura detectados. Rebuild completo del app stack..."
  compose up -d --build
else
  if [ "$NEEDS_API" -eq 1 ]; then
    info "Rebuilding API..."
    compose up -d --build --no-deps api
  fi

  if [ "$NEEDS_WEB" -eq 1 ]; then
    info "Rebuilding Web..."
    compose up -d --build --no-deps web
  fi

  if [ "$NEEDS_NGINX" -eq 1 ]; then
    info "Recargando Nginx..."
    compose up -d --no-deps nginx
  fi

  if [ "$NEEDS_API" -eq 0 ] && [ "$NEEDS_WEB" -eq 0 ] && [ "$NEEDS_NGINX" -eq 0 ]; then
    info "No hay cambios que requieran rebuild. Verificando stack..."
    compose up -d
  fi
fi

if [ "$NEEDS_PRISMA" -eq 1 ]; then
  info "Prisma cambio: ejecutando migrate deploy + generate en mero-api..."
  docker exec mero-api sh -c "cd /app/apps/api && npx prisma migrate deploy && npx prisma generate"
fi

info "Deploy completado."