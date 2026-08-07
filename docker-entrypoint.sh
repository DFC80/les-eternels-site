#!/bin/sh
set -e

echo "🗄️  Synchronisation du schéma Prisma → PostgreSQL..."
node node_modules/prisma/bin/prisma.js db push --skip-generate

echo "🚀 Démarrage de Next.js..."
exec "$@"
