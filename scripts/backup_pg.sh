#!/bin/bash
# Backup de PostgreSQL para MERO
# Uso: ./scripts/backup_pg.sh

set -euo pipefail

CONTAINER_NAME="${CONTAINER_NAME:-mero-db}"
DB_NAME="${POSTGRES_DB:-mero_db}"
DB_USER="${POSTGRES_USER:-mero}"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/mero_backup_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "Iniciando backup de ${DB_NAME}..."

docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

echo "Backup completado: ${BACKUP_FILE}"
echo "Tamaño: $(du -h "$BACKUP_FILE" | cut -f1)"

# Limpiar backups antiguos (mantener últimos 30)
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/mero_backup_*.sql.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 30 ]; then
  ls -1t "$BACKUP_DIR"/mero_backup_*.sql.gz | tail -n +31 | xargs rm -f
  echo "Backups antiguos eliminados (mantenidos: 30)"
fi
