#!/bin/bash
# Restaurar backup de PostgreSQL para MERO
# Uso: ./scripts/restore_pg.sh <archivo_backup.sql.gz>

set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Uso: $0 <archivo_backup.sql.gz>"
  echo "Backups disponibles:"
  ls -lh ./backups/mero_backup_*.sql.gz 2>/dev/null || echo "  No hay backups disponibles"
  exit 1
fi

BACKUP_FILE="$1"
CONTAINER_NAME="${CONTAINER_NAME:-mero-db}"
DB_NAME="${POSTGRES_DB:-mero_db}"
DB_USER="${POSTGRES_USER:-mero}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: archivo no encontrado: $BACKUP_FILE"
  exit 1
fi

echo "ADVERTENCIA: Esto sobreescribirá la base de datos ${DB_NAME}"
read -p "¿Continuar? (s/N): " confirm
if [ "$confirm" != "s" ] && [ "$confirm" != "S" ]; then
  echo "Cancelado"
  exit 0
fi

echo "Restaurando ${BACKUP_FILE} en ${DB_NAME}..."

gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" "$DB_NAME"

echo "Restauración completada"
