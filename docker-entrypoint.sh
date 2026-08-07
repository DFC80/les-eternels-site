#!/bin/sh
set -e

echo "🗄️  Synchronisation du schéma Prisma → PostgreSQL..."
node node_modules/prisma/build/index.js db push --skip-generate

echo "🚀 Démarrage de Next.js..."
exec "$@"
