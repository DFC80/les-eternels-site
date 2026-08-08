#!/usr/bin/env bash
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRANCH="${DEPLOY_BRANCH:-main}"
COMPOSE="sudo docker compose"

# ── Couleurs ────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $*"; }
err()  { echo -e "${RED}[deploy]${NC} $*" >&2; exit 1; }

cd "$DEPLOY_DIR"

log "=== Déploiement Les Éternels ==="
log "Dossier : $DEPLOY_DIR"
log "Branche : $BRANCH"
echo

# ── 1. Récupérer le code ───────────────────────────────────────────────────────
log "1/5 · Récupération du code..."
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

# ── 2. Vérifier si Nginx a changé ─────────────────────────────────────────────────────
NGINX_CHANGED=false
if git diff HEAD@{1} HEAD -- nginx/ docker-compose.yml 2>/dev/null | grep -q .; then
  NGINX_CHANGED=true
  warn "Changements détectés dans nginx/ ou docker-compose.yml"
fi

# ── 3. Build de l'image Next.js ───────────────────────────────────────────────────────────
log "2/5 · Build de l'image Next.js..."
$COMPOSE build back

# ── 4. Redémarrer les conteneurs ───────────────────────────────────────────────────────
log "3/5 · Redémarrage du conteneur applicatif..."
$COMPOSE up -d --no-deps back

if $NGINX_CHANGED; then
  log "4/5 · Rechargement de Nginx (config modifiée)..."
  $COMPOSE up -d --no-deps front
else
  log "4/5 · Nginx inchangé, skip."
fi

# ── 5. Vérifier que les conteneurs tournent ─────────────────────────────────────────────────────
log "5/5 · Vérification de l'état des conteneurs..."
sleep 5

BACK_STATUS=$(sudo docker inspect --format='{{.State.Status}}' les-eternels-back 2>/dev/null || echo "absent")
if [ "$BACK_STATUS" != "running" ]; then
  err "Le conteneur 'back' n'est pas en cours d'exécution (état : $BACK_STATUS)"
fi

log "Conteneur 'back' : ✓ running"
log "=== Déploiement terminé avec succès ==="
echo
$COMPOSE ps
