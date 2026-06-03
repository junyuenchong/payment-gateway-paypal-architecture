# Backend layout

A quick map of `src/` so you know where new code belongs.

```text
src/
├── common/           # config + shared HTTP helpers (no external I/O)
├── infrastructure/   # DB, Redis, BullMQ, PayPal, locks, job routing
├── modules/          # Business HTTP + CQRS (orders, payments, …)
├── app.module.ts
└── main.ts
```

---

## Common (`src/common/`)

| Folder | Role |
|--------|------|
| `config/` | All env vars via `AppConfigService` |
| `shared/` | Filters, pipes, pagination, error helpers |

See [common/README.md](./common/README.md). **Don’t** import `modules/` or `infrastructure/` from here.

---

## Domain modules (`src/modules/`)

REST APIs and business rules. Controllers should go through **CQRS** (commands/queries), not straight into fat controllers.

```text
<domain>/
├── dto/, enums/, helpers/
├── cqrs/commands/, queries/, handlers/
├── <domain>.controller.ts
├── <domain>.service.ts    # Prisma + logic (no *.repository.ts)
└── <domain>.module.ts
```

Examples today: `inventory`, `order`, `payment`, `webhook`.

---

## Infrastructure (`src/infrastructure/`)

Adapters and plumbing. **CQRS only** in `queue/` (job name maps to handler).

See [infrastructure/README.md](./infrastructure/README.md).

**Thin adapter** (locks, idempotency, payment-gateway, reconciliation):

```text
<name>/
├── dto/, helpers/, optional enums/
├── <name>.service.ts
├── <name>.controller.ts   # optional
└── <name>.module.ts
```

**Job router** (`queue/`):

```text
queue/
├── enums/                 # job + queue names
├── cqrs/handlers/         # one handler per BullMQ job
├── queue.service.ts       # enqueue
└── queue.module.ts
```

Queue name constants: `bullmq/bullmq.constants.ts`.

**Connections:** `redis/`, `bullmq/` (queues + workers).

---

## Database access

Runtime client: `infrastructure/database/prisma/`.

- `prisma.service.ts` — client
- `prisma-transaction.service.ts` — transactions
- `locks/row-lock.service.ts` — all `FOR UPDATE` SQL lives here

Schema & migrations CLI: `backend/prisma/`.

---

## Rules that keep the codebase sane

| Do | Don’t |
|----|--------|
| Put types in `dto/`, constants in `enums/` | Add `*.repository.ts` or `*.scheduler.ts` layers |
| Use `RowLockService` for row locks | Scatter `FOR UPDATE` in many services |
| Use `RedisLockService` for multi-instance locks | Wrap every Redis call in CQRS |
| Keep job-to-domain mapping in `queue` handlers | Duplicate sweep logic in reconciliation |
