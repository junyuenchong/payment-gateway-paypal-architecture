# Queue Module Layering Guide

This module follows a CQRS-oriented layered structure for asynchronous queue processing.

## Responsibilities

- `QueueController`: receives internal HTTP endpoints only (health/manual trigger style).
- `QueueProcessor`: receives BullMQ jobs and routes each job name to one command.
- `Command`: carries use-case input data (`data`) without business logic.
- `Handler`: executes the business flow for one use case.
- `QueueService`: reusable queue capabilities (enqueue, scheduling, retry options).
- `QueueRepository`: database-only concerns (query, lock, transaction, persistence).

## Rules

- Keep handlers orchestration-focused: call services/repositories, avoid SQL and queue primitives.
- Keep repository pure data access: no external HTTP/API calls.
- Keep queue service pure queue access: no domain decisions.
- Add a new job with this path:
  1. Add payload type in `queue.interface.ts`.
  2. Add job name in `queue.constant.ts`.
  3. Add command in `application/commands/queue-jobs.command.ts`.
  4. Add handler in `application/handlers/*`.
  5. Register handler in `cqrs/index.ts`.
  6. Map job -> command factory in `queue.processor.ts`.

## Why this shape

- Improves testability (small isolated handlers/services/repositories).
- Keeps idempotency and transaction logic explicit in repository layer.
- Makes job routing predictable and easy to extend.
