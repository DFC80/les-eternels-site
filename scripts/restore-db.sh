#!/bin/bash
# Restauration d'une sauvegarde PostgreSQL (les-eternels-site)
# Usage : ./scripts/restore-db.sh /var/backups/les-eternels/db_20250101_030000.sql.gz
#
# ATTENTION : écrase la base de données existante.

set -euo pipefail

BACKUP_FILE="${1:-}"
if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
  echo "Usage : $0 <fichier_backup.sql.gz>"
  echo "Fichiers disponibles :"
  ls -lht "${BACKUP_DIR:-/var/backups/les-eternels}/db_"*.sql.gz 2>/dev/null | head -10 || echo "  (aucun)"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [[ -f "$PROJECT_DIR/.env" ]]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "$PROJECT_DIR/.env" | grep -E '^(POSTGRES_USER|POSTGRES_DB|POSTGRES_PASSWORD)=' | xargs)
fi

DB_CONTAINER="${DB_CONTAINER:-les-eternels-db}"
DB_USER="${POSTGRES_USER:-eternels}"
DB_NAME="${POSTGRES_DB:-les_eternels}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restauration de $BACKUP_FILE vers $DB_NAME..."
read -rp "Confirmer ? Cela écrase la base actuelle. [oui/N] " CONFIRM
[[ "$CONFIRM" != "oui" ]] && echo "Annulé." && exit 0

gunzip -c "$BACKUP_FILE" | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restauration terminée."
