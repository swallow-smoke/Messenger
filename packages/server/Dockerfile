FROM node:22-alpine3.20 AS base
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# ── deps stage ──────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json ./
COPY packages/server/package.json ./packages/server/
COPY packages/server/prisma ./packages/server/prisma
COPY pnpm-lock.yaml ./
# Install only server production deps + prisma (needed for generate)
RUN pnpm install --filter server --frozen-lockfile

# ── build stage ─────────────────────────────────────────────
FROM deps AS build
WORKDIR /app
COPY packages/server ./packages/server
RUN packages/server/node_modules/.bin/prisma generate --schema=packages/server/prisma/schema.prisma
RUN pnpm --filter server build

# ── production stage ─────────────────────────────────────────
FROM node:22-alpine3.20 AS production
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json ./
COPY packages/server/package.json ./packages/server/
COPY packages/server/prisma ./packages/server/prisma
COPY pnpm-lock.yaml ./

# Install server deps, including prisma CLI for local container schema sync.
RUN pnpm install --filter server --frozen-lockfile

# Copy compiled output and generate prisma client for this image.
COPY --from=build /app/packages/server/dist ./packages/server/dist
RUN packages/server/node_modules/.bin/prisma generate --schema=packages/server/prisma/schema.prisma

WORKDIR /app/packages/server
EXPOSE 4000

# Sync the local development database schema then start.
CMD ["sh", "-c", "node_modules/.bin/prisma db push --accept-data-loss && node dist/app.js"]
