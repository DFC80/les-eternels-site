#!/bin/bash
# Sauvegarde quotidienne de la base PostgreSQL (les-eternels-site)
# Usage : lancé automatiquement par cron à 3h00 chaque nuit
#
# Prérequis :
#   - Docker actif avec le conteneur "les-eternels-db" en cours d'exécution
#   - Variables POSTGRES_USER et POSTGRES_DB définies dans .env (ou en dur ci-dessous)

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Charge les variables depuis le .env du projet si présent
if [[ -f "$PROJECT_DIR/.env" ]]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "$PROJECT_DIR/.env" | grep -E '^(POSTGRES_USER|POSTGRES_DB|POSTGRES_PASSWORD)=' | xargs)
fi

DB_CONTAINER="${DB_CONTAINER:-les-eternels-db}"
DB_USER="${POSTGRES_USER:-eternels}"
DB_NAME="${POSTGRES_DB:-les_eternels}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/les-eternels}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# ── Sauvegarde ─────────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Démarrage de la sauvegarde → $BACKUP_FILE"

docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Sauvegarde terminée — $SIZE"

# ── Rotation : supprime les fichiers plus vieux que RETENTION_DAYS jours ───────
DELETED=$(find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +"$RETENTION_DAYS" -print -delete | wc -l)
if [[ "$DELETED" -gt 0 ]]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $DELETED ancien(s) backup(s) supprimé(s) (rétention : ${RETENTION_DAYS}j)"
fi
