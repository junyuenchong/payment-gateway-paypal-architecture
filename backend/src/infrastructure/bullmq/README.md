# BullMQ (queues & workers)

Registers Redis queues and runs workers that pick up jobs. Workers don’t contain business logic — they forward to CQRS commands in `infrastructure/queue/`.

```text
bullmq/
├── bullmq.module.ts          # forRoot + register all queues
├── bullmq.constants.ts         # EMAIL_QUEUE, AUDIT_QUEUE, NOTIFICATION_QUEUE
├── helpers/queue.defaults.ts   # Default retry/backoff options
├── queues/                     # email, audit, notification
└── workers/                    # One worker per queue + worker.helper.ts
```

Workers are wired in `infrastructure/queue/queue.module.ts` (handlers must exist first).

---

## The three queues

| Queue | Env override (optional) | Typical jobs |
| ----- | ----------------------- | ------------ |
| `email-queue` | `BULLMQ_EMAIL_QUEUE_NAME` | `create-payment-intent`, `capture-payment`, `mock-capture-success` |
| `audit-queue` | `BULLMQ_AUDIT_QUEUE_NAME` | `process-webhook-event` |
| `notification-queue` | `BULLMQ_NOTIFICATION_QUEUE_NAME` | Expire / reconcile sweeps |

**Enqueue from app code:** `infrastructure/queue/queue.service.ts`.

See also [queue/README.md](../queue/README.md).
