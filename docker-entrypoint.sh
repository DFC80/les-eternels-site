#!/bin/sh
set -e

echo "🗄️  Synchronisation du schéma Prisma → PostgreSQL..."
node_modules/.bin/prisma db push --skip-generate

echo "🚀 Démarrage de Next.js..."
exec "$@"
