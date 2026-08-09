#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# init-letsencrypt.sh — Obtention du certificat Let's Encrypt (1ère fois)
# À exécuter UNE SEULE FOIS avant "docker compose up -d"
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Vérifications ─────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo "❌ Fichier .env introuvable. Copiez .env.example vers .env et remplissez-le."
  exit 1
fi

# Charge les variables du .env (supporte les valeurs avec espaces et caractères spéciaux)
set -a
# shellcheck source=.env
source .env
set +a

if [ -z "${DOMAIN:-}" ]; then
  echo "❌ Variable DOMAIN manquante dans .env (ex: DOMAIN=les-eternels.fr)"
  exit 1
fi

if [ -z "${CERTBOT_EMAIL:-}" ]; then
  echo "❌ Variable CERTBOT_EMAIL manquante dans .env (ex: CERTBOT_EMAIL=contact@les-eternels.fr)"
  exit 1
fi

echo "🔐 Initialisation HTTPS pour ${DOMAIN} (email: ${CERTBOT_EMAIL})"

CERT_DIR="./certbot/conf/live/${DOMAIN}"
mkdir -p ./certbot/conf ./certbot/www

# ── 1. Paramètres TLS recommandés par Certbot ─────────────────────────────────
if [ ! -f ./certbot/conf/options-ssl-nginx.conf ]; then
  echo "📥 Téléchargement des paramètres TLS recommandés..."
  curl -sS https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
    -o ./certbot/conf/options-ssl-nginx.conf
  echo "   Génération du groupe Diffie-Hellman (peut prendre 1-2 min)..."
  openssl dhparam -out ./certbot/conf/ssl-dhparams.pem 2048 2>/dev/null
  echo "✅ Paramètres TLS prêts"
fi

# ── 2. Certificat auto-signé temporaire pour que Nginx puisse démarrer ────────
if [ ! -d "${CERT_DIR}" ]; then
  echo "📋 Création d'un certificat auto-signé temporaire..."
  mkdir -p "${CERT_DIR}"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "${CERT_DIR}/privkey.pem" \
    -out    "${CERT_DIR}/fullchain.pem" \
    -subj   "/CN=localhost" 2>/dev/null
  echo "✅ Certificat temporaire créé"
fi

# ── 3. Démarrage de Nginx avec le certificat temporaire ───────────────────────
echo "🚀 Démarrage de Nginx..."
docker compose up -d front
echo "   Attente du démarrage..."
sleep 5

# ── 4. Suppression du certificat temporaire ───────────────────────────────────
echo "🗑️  Suppression du certificat temporaire..."
rm -rf "${CERT_DIR}"

# ── 5. Obtention du vrai certificat Let's Encrypt ─────────────────────────────
echo "🌐 Demande du certificat Let's Encrypt..."
docker compose run --rm --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot \
  --email "${CERTBOT_EMAIL}" \
  -d "${DOMAIN}" \
  --rsa-key-size 4096 \
  --agree-tos \
  --force-renewal \
  --non-interactive

# ── 6. Rechargement de Nginx avec le vrai certificat ──────────────────────────
echo "🔄 Rechargement de Nginx..."
docker compose exec front nginx -s reload

echo ""
echo "✅ HTTPS opérationnel !"
echo "   → https://${DOMAIN}"
echo ""
echo "ℹ️  Prochaines étapes :"
echo "   1. docker compose up -d   (démarrer tous les conteneurs)"
echo "   2. Le certificat se renouvelle automatiquement toutes les 12h."
