#!/bin/sh
set -e

echo ">> Running Prisma migrations..."
cd /app/apps/api
npx prisma migrate deploy

echo ">> Seeding database..."
npx prisma db seed

echo ">> Starting API server..."
cd /app
exec node apps/api/dist/main.js
