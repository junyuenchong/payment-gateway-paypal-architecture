# Queue module

The **front door for background work**: enqueue jobs from HTTP/services, and run CQRS handlers when a worker picks a job up.

Workers live in `infrastructure/bullmq/workers/`. Flow:

**Worker**, then **Command**, then **Handler**, then **Service**

---

## Layout

```text
queue/
├── dto/queue-job.dto.ts
├── enums/
│   ├── queue-job.enum.ts
│   └── bullmq-queue.enum.ts
├── helpers/queue.helper.ts, queue-routing.ts
├── cqrs/
│   ├── commands/queue-jobs.command.ts
│   └── handlers/*-job.handler.ts
├── queue.service.ts       # enqueue helpers
├── queue.controller.ts    # ops / internal routes
└── queue.module.ts
```

---

## Queues at a glance

| Queue | Worker | Jobs |
|-------|--------|------|
| `email-queue` | `EmailWorker` | payment intent, capture, mock capture |
| `audit-queue` | `AuditWorker` | `process-webhook-event` |
| `notification-queue` | `NotificationWorker` | expire / reconcile sweeps |

Canonical names: `bullmq/bullmq.constants.ts`.

---

## Adding a new background job

1. Payload type in `dto/queue-job.dto.ts`
2. Job name constant in `enums/queue-job.enum.ts`
3. Command class in `cqrs/commands/queue-jobs.command.ts`
4. Handler in `cqrs/handlers/<name>-job.handler.ts` + export in `cqrs/index.ts`
5. Worker routing in `bullmq/workers/worker.helper.ts`
6. Queue routing + worker allow-list in `helpers/queue-routing.ts`
7. Public enqueue method in `queue.service.ts` (if callers need it)

---

## Related

- [Infrastructure overview](../README.md)
- [BullMQ wiring](../bullmq/README.md)
