# Documentation

Guides for the PaymentWebhook project. Start with the root [README](../README.md) for setup and APIs.

| Document | What it covers |
| -------- | -------------- |
| [Payment & inventory flow](./paymentflow.md) | End-to-end checkout, payment, webhook, and stock reservation |
| [Prisma & seeder](../backend/prisma/README.md) | Schema, migrations, `seeder/`, Nest `database/prisma` |
| [App config](../backend/src/config/README.md) | Centralized env / `AppConfigService` |
| [Integrations](../backend/src/integrations/README.md) | Redis, BullMQ, mail, storage, ES stubs |
| [Shared](../backend/src/shared/README.md) | DTOs, pipes, filters, error helpers |
| [Inventory module](../backend/src/modules/inventory/README.md) | Stock reservation, ledger, CQRS |
| [Queue module](../backend/src/modules/queue/README.md) | BullMQ jobs, `processors/`, CQRS handlers |
| [Frontend (Next.js)](../apps/web/README.md) | Checkout UI, API client, env, local dev |

## Quick links

- Local stack: `docker compose up --build` from repo root
- Backend API: `http://localhost:3000`
- Frontend: `http://localhost:8080`
- Inventory: `GET /inventory/products`
- Seed demo data: `cd backend && npm run db:seed`

## Backend layout (reference)

```text
backend/
├── prisma/                 # schema, migrations, seeder/
└── src/
    ├── config/
    ├── database/prisma/    # Nest PrismaModule
    ├── integrations/     # redis, bullmq, …
    ├── shared/             # dto, filters, pipes, helpers
    └── modules/            # domain features only
```
