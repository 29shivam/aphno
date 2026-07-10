# aphno.ai

**UPI-native expense splitting + financial intelligence.** Split bills in groups,
track who owes whom, and settle up in one tap via a UPI deep link.

A TypeScript monorepo: a Fastify + Prisma API, and one Expo (React Native)
codebase that runs as both a **web app** and a **downloadable mobile app**.

```
apps/
  api/       Fastify API — auth, users, groups, expenses, settlements, balances
  mobile/    Expo app (web + iOS + Android) — login, groups, expenses, settle-up
packages/
  db/        Prisma schema, migrations, and client
  shared/    Zod schemas + types shared by the API and the app
```

## Features

- **Phone OTP auth** — request a 6-digit code, verify, get a JWT (HS256).
- **Groups** — create groups, add members by phone (stub users for new numbers).
- **Expenses** — split `EQUAL`, `EXACT`, or `PERCENT`; amounts stored as integer
  paise so shares always sum exactly (no rounding drift).
- **Balances** — net position per member + a minimal set of settle-up transfers.
- **Settlements** — record a payment, get a `upi://pay?...` deep link, confirm it,
  and watch balances zero out.

## Prerequisites

- Node.js **≥ 20.10**
- pnpm **9** (`corepack enable`)
- A PostgreSQL database (this project uses [Neon](https://neon.tech))

## Setup

```bash
pnpm install

# Create the env files (see .env.example for all vars):
#   apps/api/.env       DATABASE_URL, JWT_SECRET, PORT=4000, ...
#   packages/db/.env    DATABASE_URL, DIRECT_URL   (for Prisma migrations)
#   apps/mobile/.env    EXPO_PUBLIC_API_URL=http://localhost:4000
cp .env.example apps/api/.env   # then edit

# Apply database migrations:
pnpm --filter @aphno/db exec prisma migrate deploy
```

## Run the app

**1. Start the API** (http://localhost:4000, Swagger UI at `/docs`):

```bash
pnpm --filter @aphno/api dev
```

**2a. Run the web app** (http://localhost:8081):

```bash
pnpm --filter @aphno/mobile web
```

**2b. Run on a phone** — install **Expo Go**, then:

```bash
pnpm --filter @aphno/mobile start     # scan the QR code
```

> On a physical device, set `EXPO_PUBLIC_API_URL` to your machine's LAN IP
> (e.g. `http://192.168.0.98:4000`) — a device can't reach `localhost`.

Everything at once: `pnpm dev` (runs all `dev` tasks via Turborepo).

## Test & typecheck

```bash
pnpm test         # vitest — money math, split allocation, JWT/OTP
pnpm typecheck    # tsc across all packages
```

## Build a downloadable mobile app

The Expo app builds to a native APK/IPA via EAS. See
[`apps/mobile/README.md`](apps/mobile/README.md):

```bash
cd apps/mobile
npx eas-cli build --platform android --profile preview   # → installable .apk
```

## Deploy

- **API** → Railway (Docker). **Web** → Vercel (static export).

See [`infra/DEPLOY.md`](infra/DEPLOY.md) for the full walkthrough.

## API overview

All routes are under `/v1` and documented interactively at `/docs`.

| Area        | Endpoints                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| Auth        | `POST /auth/otp/request`, `POST /auth/otp/verify`                                                        |
| Users       | `GET /users/me`, `PATCH /users/me`                                                                       |
| Groups      | `POST /groups`, `GET /groups`, `GET /groups/:id`, `POST /groups/:id/members`, `GET /groups/:id/balances` |
| Expenses    | `POST /groups/:id/expenses`, `GET /groups/:id/expenses`, `DELETE /expenses/:id`                          |
| Settlements | `POST /groups/:id/settlements`, `POST /settlements/:id/complete`, `GET /groups/:id/settlements`          |
