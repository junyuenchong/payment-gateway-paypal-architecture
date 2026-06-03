# Infrastructure

Code that **talks to the outside world**: Postgres, Redis, PayPal, background queues. Business HTTP routes stay in `src/modules/`.

Full layout rules: [STRUCTURE.md](../STRUCTURE.md).

---

## How this folder is organized

Think of three levels:

```text
infrastructure/
├── database/prisma/     # DB client, transactions, row locks
├── redis/               # Shared Redis connection (locks, etc.)
├── bullmq/              # Queue registration + workers
├── locks/               # Distributed locks across app instances
├── idempotency/         # “Already processed this webhook?”
├── payment-gateway/     # PayPal + mock checkout
├── reconciliation/      # Fix orders stuck in PROCESSING
└── queue/               # Enqueue jobs + map them to domain handlers
```

| Level | Folders | CQRS? |
|-------|---------|-------|
| Connections | `redis`, `bullmq` | No — just wiring |
| Adapters | `locks`, `idempotency`, `payment-gateway`, `reconciliation` | Usually no — service + helpers |
| Job routing | `queue` | Yes — one handler per BullMQ job name |

Row-level locks inside a transaction: `database/prisma/locks/row-lock.service.ts`.

---

## Adding a new external integration (template)

```text
<name>/
├── dto/
├── enums/              # optional
├── helpers/
├── <name>.service.ts
├── <name>.controller.ts   # optional health/status route
├── <name>.module.ts
└── README.md
```

---

## Queues: who does what

| Piece | Where |
|-------|--------|
| Queue names from env | `bullmq/bullmq.constants.ts` |
| Re-export for queue module | `queue/enums/bullmq-queue.enum.ts` |
| Job name constants | `queue/enums/queue-job.enum.ts` |
| Which job goes to which queue | `queue/helpers/queue-routing.ts` |
| Business logic for a job | `queue/cqrs/handlers/*-job.handler.ts` |
| BullMQ worker entry | `bullmq/workers/*.worker.ts` |

---

## “Where should this code go?”

| You need to… | Put it in… |
|--------------|------------|
| Add a REST business rule | `modules/<domain>/` |
| Call an external API | New or existing adapter folder here |
| Add a background job | `queue` handler + register in `bullmq` worker |
| Lock across multiple servers | `RedisLockService` in `locks/` |
| Lock a DB row in a transaction | `RowLockService` in `database/prisma/locks/` |

---

## Module load order

Defined in `modules/feature-modules.ts`:

1. `RedisIntegrationModule`, then `BullMqIntegrationModule`
2. `LocksModule`, `IdempotencyModule`, `PaymentGatewayModule`
3. Domain: Inventory, Order, Payment, Webhook
4. `QueueModule`, `ReconciliationModule` (workers need handlers above)

---

## Per-folder guides

| Folder | README |
|--------|--------|
| [redis](./redis/README.md) | Shared Redis client |
| [bullmq](./bullmq/README.md) | Queues & workers |
| [locks](./locks/README.md) | Distributed locks |
| [idempotency](./idempotency/README.md) | Webhook deduplication |
| [payment-gateway](./payment-gateway/README.md) | PayPal / mock |
| [reconciliation](./reconciliation/README.md) | Gateway vs DB sweeps |
| [queue](./queue/README.md) | Enqueue API & job handlers |
| [database/prisma](./database/prisma/README.md) | Prisma client & DB locks |
