# Ops (DLQ + metrics)

Inspect failed BullMQ jobs and queue depth. Failed jobs stay in Redis after max retries (`BULLMQ_REMOVE_ON_FAIL`), which is this app's dead-letter set.

```text
ops/
├── dto/ops.dto.ts
├── ops.service.ts
├── ops.controller.ts
└── ops.module.ts
```

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/ops/dlq?limit=50&queue=` | List failed jobs (optional queue filter) |
| `POST` | `/ops/dlq/:jobId/replay?queue=` | Retry one failed job (`queue` required) |
| `GET` | `/ops/metrics` | Waiting / active / delayed / failed counts |

Rate limiting is skipped on these routes (`@SkipThrottle`).
