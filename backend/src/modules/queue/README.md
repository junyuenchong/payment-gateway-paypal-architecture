# Queue module

BullMQ workers for payments, webhooks, inventory sweeps, and reconciliation.

Layering: **Processor → Command → Handler → Service / Repository**

---

## Structure

```text
queue/
├── processors/                    # BullMQ worker + job handlers
│   ├── queue.processor.ts         # Routes job name → CQRS command
│   ├── *-job.handler.ts           # One handler per job type
│   └── index.ts
├── application/
│   └── commands/                  # Queue job CQRS commands
├── cqrs/index.ts                  # Registers processor handlers
├── queue.service.ts               # Enqueue + schedules
├── queue.repository.ts
├── queue.constant.ts
└── queue.module.ts
```

---

## Layer responsibilities

| Layer | Role |
| ----- | ---- |
| `QueueController` | Internal HTTP only (health / manual triggers) |
| `processors/queue.processor.ts` | Maps BullMQ job name → CQRS command |
| `processors/*-job.handler.ts` | Executes one job use case |
| `application/commands/` | Job payload wrappers (no business logic) |
| `QueueService` | Enqueue, repeat schedules, retry options |
| `QueueRepository` | DB locks and persistence for jobs |

---

## Registered jobs

| Job name | Handler | Responsibility |
| -------- | ------- | -------------- |
| `create-payment-intent` | `CreatePaymentIntentJobHandler` | Create PayPal / mock checkout |
| `process-webhook` | `ProcessWebhookJobHandler` | Update order + inventory |
| `capture-payment` | `CapturePaymentJobHandler` | Capture payment at gateway |
| `expire-orders-sweep` | `ExpireOrdersSweepJobHandler` | `PROCESSING` → `EXPIRED`, release stock |
| `expire-reservations-sweep` | `ExpireReservationsSweepJobHandler` | → `ExpireStaleReservationsCommand` |
| `expire-unpaid-orders-sweep` | `ExpireUnpaidOrdersSweepJobHandler` | → `ExpireUnpaidOrdersCommand` |
| `reconcile-orders-sweep` | `ReconcileOrdersSweepJobHandler` | Fix stuck `PROCESSING` vs gateway |
| `mock-capture-success` | `MockCaptureSuccessJobHandler` | Simulate successful capture |

**Retry defaults:** 5 attempts, exponential backoff (1s base) for payment/webhook jobs; 3 attempts, fixed 1s for sweeps.

---

## Add a new job

1. Payload type → `queue.interface.ts`
2. Job name → `queue.constant.ts` (`JOBS`)
3. Command → `application/commands/queue-jobs.command.ts`
4. Handler → `processors/<name>-job.handler.ts`
5. Export handler → `processors/index.ts`
6. Register in `cqrs/index.ts` (`CommandHandlers`)
7. Map job → command in `processors/queue.processor.ts` (`COMMAND_BY_JOB`)
8. Enqueue helper → `queue.service.ts` (if needed)

---

## Rules

- Handlers in `processors/` orchestrate only — no raw SQL or BullMQ APIs.
- Repositories own transactions and `FOR UPDATE` locks.
- `QueueService` owns enqueue idempotency (`jobId`).
- Inventory sweeps delegate to [inventory module](../inventory/README.md) CQRS commands.

---

## Related docs

- [Payment & inventory flow](../../../docs/paymentflow.md)
- [Project README](../../../README.md)
