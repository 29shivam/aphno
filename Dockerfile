# Production image for the APHNO API (Fastify + Prisma) — deploy target: Railway.
# Runs the monorepo API via tsx so workspace TypeScript packages and the Prisma
# client resolve exactly as they do in development.
FROM node:20-bookworm-slim AS base
# Prisma's query engine needs openssl at runtime.
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# Install dependencies against the lockfile (better layer caching).
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/mobile/package.json apps/mobile/package.json
RUN pnpm install --frozen-lockfile

# Copy the rest of the source.
COPY . .

# Generate the Prisma client for this platform.
RUN pnpm --filter @aphno/db exec prisma generate

ENV NODE_ENV=production
EXPOSE 4000

# Apply pending migrations, then start the API.
CMD ["sh", "-c", "pnpm --filter @aphno/db exec prisma migrate deploy && pnpm --filter @aphno/api start"]
