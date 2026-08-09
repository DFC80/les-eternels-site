FROM node:20-alpine AS base

# ── 1. Dépendances ──────────────────────────────────────────────────────────
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# ── 2. Build ─────────────────────────────────────────────────────────────────
FROM base AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Passe le provider SQLite → PostgreSQL pour le build de production
RUN sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
RUN npx prisma generate
# Compile seed.ts → seed.js (bundle bcryptjs, @prisma/client reste externe)
RUN npx esbuild prisma/seed.ts --bundle --platform=node --external:@prisma/client --outfile=prisma/seed.js
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npm run build

# ── 3. Image de production ───────────────────────────────────────────────────
FROM base AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Dossiers uploads persistants (montés en volume)
RUN mkdir -p ./public/uploads ./uploads/activity-docs \
 && chown -R nextjs:nodejs ./public/uploads ./uploads

# Fichiers statiques publics
COPY --from=builder /app/public ./public

# Build standalone Next.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static

# Prisma CLI + client (pour prisma db push au démarrage)
COPY --from=builder /app/prisma              ./prisma
COPY --from=builder /app/node_modules/.prisma         ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma         ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma          ./node_modules/prisma

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
