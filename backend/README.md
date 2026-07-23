# Backend

NestJS API with Prisma (Postgres) and BullMQ (Redis) workers. This is where orders, payments, webhooks, and inventory logic live.

**Before you start:** copy env and fill in what you need.

```bash
cp .env.example .env
```

PayPal keys matter only if you turn off mock mode. Everything else has sensible defaults in `.env.example`.

**Also useful:** [Prisma & seeds](./prisma/README.md) · [Config](./src/common/config/README.md) · [Src layout](./src/STRUCTURE.md) · [Project root](../README.md)

---

## Folder structure

```text
backend/
├── .env.example              # Copy to .env — all API settings
├── docker-compose.yml        # API + Postgres + Redis + Adminer
├── Dockerfile
├── package.json
├── prisma/                   # Schema, migrations, seed scripts (CLI)
│   ├── schema.prisma
│   ├── migrations/
│   └── seeder/
├── scripts/                  # e.g. gen:module, merge-repository helper
├── test/                     # E2E / integration tests
└── src/
    ├── main.ts               # Bootstrap
    ├── app.module.ts
    ├── STRUCTURE.md          # Where to put new code (rules)
    ├── common/               # Config + shared HTTP (no PayPal/Redis/DB)
    │   ├── config/           # AppConfigService, .env parsing
    │   └── shared/           # Filters, Zod pipe, pagination DTOs
    ├── infrastructure/       # External systems & async plumbing
    │   ├── database/prisma/  # Prisma client, transactions, row locks
    │   ├── redis/            # Shared ioredis client
    │   ├── bullmq/           # Queues + workers
    │   ├── locks/            # Distributed Redis locks
    │   ├── idempotency/      # Webhook deduplication
    │   ├── ops/              # DLQ list/replay + queue metrics
    │   ├── payment-gateway/  # PayPal + mock checkout
    │   ├── reconciliation/   # Stuck PROCESSING order sweeps
    │   └── queue/            # Enqueue jobs + CQRS job handlers
    └── modules/              # Business HTTP + CQRS
        ├── feature-modules.ts   # Module import order
        ├── inventory/        # Stock reserve / commit / release
        ├── order/            # Orders, line items, status
        ├── payment/          # Payment intents, capture
        └── webhook/          # PayPal webhook intake
```

| Area | What lives here |
| ---- | ---------------- |
| `prisma/` | Database schema and migrations — see [prisma/README.md](./prisma/README.md) |
| `src/common/` | Env config and cross-cutting HTTP helpers |
| `src/infrastructure/` | DB client, Redis, BullMQ, PayPal adapter, locks — see [infrastructure/README.md](./src/infrastructure/README.md) |
| `src/modules/` | REST APIs and domain rules (controller, CQRS, service) |

**Typical request path:** `Controller`, then `Command` / `Query`, then `Handler`, then `Service` (Prisma in services; no separate `*.repository.ts` layer).

---

## Run with Docker (recommended)

From this folder (`backend/`):

```bash
cp .env.example .env
docker compose up --build
```

Seed demo products the first time:

```bash
docker compose exec backend npm run db:seed
```

| Service        | URL                          |
| -------------- | ---------------------------- |
| API            | http://localhost:3000        |
| Adminer (DB UI)| http://localhost:8081        |
| Postgres (host)| localhost:5433               |
| Redis (host)   | localhost:6380               |

Adminer login: user / password / database all `payment`.

The Next.js shop runs on your host:

```bash
cd ../apps/web && npm run dev
```

Open http://localhost:8080

**Handy Docker commands:**

```bash
docker compose up -d --build      # detached
docker compose logs -f backend    # follow API logs
docker compose exec backend npm run db:seed
docker compose down
docker compose down -v            # wipes DB volume — start fresh
```

**Optional port overrides** in `.env`:

```env
PORT=3000
POSTGRES_HOST_PORT=5433
REDIS_HOST_PORT=6380
ADMINER_HOST_PORT=8081
FRONTEND_BASE_URL=http://localhost:8080
```

---

## Run locally (no Docker)

You need PostgreSQL and Redis reachable at the hosts in `backend/.env` (defaults: `localhost:5432` and `6379`).

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
npm run start:dev
```

API: http://localhost:3000
