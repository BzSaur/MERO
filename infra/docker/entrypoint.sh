#!/bin/sh
set -e

echo ">> Running Prisma migrations..."
cd /app/apps/api
npx prisma migrate deploy

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo ">> Seeding database..."
  npx prisma db seed
else
  echo ">> Skipping seed (RUN_SEED != true)"
fi

echo ">> Starting API server..."
cd /app
exec node apps/api/dist/main.js
