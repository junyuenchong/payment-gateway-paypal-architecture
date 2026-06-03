# Webhook idempotency

PayPal (and other providers) may deliver the **same webhook more than once**. This module records what we’ve already handled so the second delivery is a no-op.

Uses `ProcessedEvent` and `WebhookEvent` tables in Postgres.

```text
idempotency/
├── dto/idempotency.dto.ts
├── enums/processed-event-provider.enum.ts
├── idempotency.service.ts
├── idempotency.controller.ts
└── idempotency.module.ts
```

Straight service + Prisma — no CQRS layer in this folder.

Typical flow: verify signature, check idempotency, persist event, enqueue `process-webhook` job.
