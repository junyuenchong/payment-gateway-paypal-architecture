# Payment Webhook Architecture

Production-style payment workflow demo with asynchronous processing, idempotent webhook handling, and operational recovery support.

## Overview

This project demonstrates how to build a resilient payment system that is:

- asynchronous (queue-based background workers)
- idempotent (safe retries and duplicate protection)
- consistent (transaction + lock strategy)
- observable (ops endpoints and queue metrics)
- recoverable (dedicated dead-letter queue and replay)

## Tech Stack

### Backend

- `NestJS 11` (`@nestjs/common`, `@nestjs/core`, `@nestjs/cqrs`)
- `BullMQ` + `@nestjs/bullmq` for job queues and workers
- `Prisma 5` + `PostgreSQL` for persistence
- `ioredis` for distributed lock support
- `Zod`, `class-validator`, `class-transformer` for validation patterns
- `pino` / `pino-http` for structured logging
- `OpenTelemetry` packages for tracing hooks

### Frontend

- `Next.js 16`
- `React 19`
- `TypeScript`
- `Tailwind CSS 4`

### DevOps and tooling

- `Docker Compose` for local multi-service orchestration
- `ESLint` + `Prettier` for code quality
- `Jest` + `Supertest` for test coverage
- `Husky` for Git hook automation

## Architecture Highlights

- CQRS-style module design for clear responsibility boundaries
- Async payment intent creation and webhook processing via queue workers
- Webhook signature verification + event persistence
- Idempotency guardrails (`jobId`, processed event marker, order-level checks)
- Strong consistency with `prisma.$transaction` + `SELECT ... FOR UPDATE`
- Redis distributed locks for cross-instance race protection
- DLQ (`payment-dlq-queue`) with replay endpoints for failed jobs
- Scheduled reconciliation for stuck `PROCESSING` orders

## Layering Convention

- `Controller`: receives HTTP requests
- `Command`: carries use-case input payload
- `Handler`: orchestrates the business flow
- `Service`: reusable business/integration logic
- `Repository`: database access only

## Project Structure

```text
PaymentWebhook/
├─ backend/                  # NestJS API and workers
│  ├─ src/modules/           # Domain and infra modules
│  ├─ prisma/                # Prisma schema and seed
│  └─ scripts/               # Internal generators/lint scripts
├─ apps/web/                 # Next.js frontend
└─ docker-compose.yml        # Local stack (frontend, backend, postgres, redis, adminer)
```

## Core Payment Flow

1. `POST /orders` creates an order in `UNPAID`.
2. `POST /orders/:id/payment-intent` moves it to `PROCESSING` and enqueues checkout creation.
3. Worker creates gateway checkout and stores `paypalOrderId` + `approvalUrl`.
4. Frontend polls `GET /orders/:id` until `approvalUrl` is available.
5. Gateway sends webhook to `POST /webhooks/paypal`.
6. Backend verifies signature, stores event, and enqueues webhook processing.
7. Worker updates final status: `PAID` / `FAILED` / `CANCELLED`.
8. Expiry sweep marks stale `PROCESSING` orders as `EXPIRED`.

## End-to-End Workflow Diagram

| Seq | From | To | Action / Event | Core Controls |
| --- | --- | --- | --- | --- |
| 1 | User / Frontend | Order API | `POST /orders` | Create order as `UNPAID` in PostgreSQL |
| 2 | User / Frontend | Order Intent Handler | `POST /orders/:id/payment-intent` with idempotency key | Request-level duplicate protection |
| 3 | Order Intent Handler | Redis Lock | Acquire `lock:order:intent:<orderId>` | Cross-instance concurrency guard |
| 4 | Redis Lock | DB Transaction | `SELECT ... FOR UPDATE` | Row lock + transactional consistency |
| 5 | DB Transaction | PostgreSQL | Update order to `PROCESSING` | Prevent invalid concurrent transitions |
| 6 | DB Transaction | BullMQ `create-payment-intent` | Enqueue intent job | Deterministic `jobId` dedupe |
| 7 | BullMQ `create-payment-intent` | Worker: Create Payment Intent | Job execution starts | Attempts + exponential/fixed backoff |
| 8 | Intent Worker | Payment Gateway | Call PayPal / Mock gateway | Retry-safe external call pattern |
| 9 | Intent Worker | PostgreSQL | Save `paypalOrderId` + `approvalUrl` | Idempotent persistence checks |
| 10 | User / Frontend | Order Query API | Poll `GET /orders/:id` | Read latest status/approval URL |
| 11 | Payment Gateway | Webhook Receiver | Send webhook event | Async callback entrypoint |
| 12 | Webhook Receiver | Signature Verification | Validate webhook signature | Reject invalid requests (`400`) |
| 13 | Signature Verification | Idempotency Check | Check `ProcessedEvent(eventId)` | Ignore duplicate events safely |
| 14 | Idempotency Check | Persist WebhookEvent | Save webhook payload/status | Audit trail + dedupe marker |
| 15 | Persist WebhookEvent | BullMQ `process-webhook` | Enqueue webhook processing job | Retry + job-level dedupe |
| 16 | BullMQ `process-webhook` | Worker: Process Webhook | Execute webhook business flow | Async isolation from API latency |
| 17 | Webhook Worker | Redis Lock | Acquire `lock:webhook:event:<eventId>` | Prevent concurrent same-event processing |
| 18 | Redis Lock | DB Transaction + Row Lock | Lock and update order safely | Atomic status transition |
| 19 | Reconciliation / Expiry Sweep | BullMQ sweep jobs | Enqueue periodic reconciliation/expiry jobs | Self-healing for stuck `PROCESSING` |
| 20 | BullMQ sweep jobs | Worker: Reconcile or Expire | Reconcile gateway state or mark `EXPIRED` | Eventual consistency control |
| 21 | Any worker failure | Same BullMQ queue | Retry (`attempts + backoff`) | Automatic transient failure recovery |
| 22 | Max retries exceeded | BullMQ `payment-dlq-queue` | Move failed payload to DLQ | Manual replay via ops endpoints |

## Workflow Steps Table

| Step | Stage | Component | What happens | Reliability / Control |
| --- | --- | --- | --- | --- |
| 1 | Order creation | `POST /orders` | Create order as `UNPAID` | Input validation + DB write |
| 2 | Payment intent request | `POST /orders/:id/payment-intent` | Accept intent request with idempotency key | Duplicate request protection |
| 3 | Concurrency guard | Redis lock + DB row lock | Prevent concurrent updates for same order | `SET NX + TTL` + `FOR UPDATE` |
| 4 | Queue enqueue | BullMQ intent queue | Push `create-payment-intent` job | Job dedupe via `jobId` |
| 5 | Gateway call | Intent worker | Create gateway order / approval link | Retry + backoff on transient failure |
| 6 | Webhook intake | `POST /webhooks/paypal` | Verify signature, parse event | Reject invalid signature |
| 7 | Idempotency | Webhook event check | Ignore already-processed `eventId` | `ProcessedEvent` unique guard |
| 8 | Async status update | Webhook worker | Update order terminal state | Transactional update with lock |
| 9 | Reconciliation | Sweep workers | Reconcile/expire stuck `PROCESSING` | Scheduled queue jobs |
| 10 | Failure recovery | DLQ + replay API | Store and replay exhausted failures | `/ops/dlq` + `/ops/dlq/:jobId/replay` |

## BullMQ Queues and Retry Table

| Queue / Job | Trigger | Attempts | Backoff | Idempotency | Failure Path |
| --- | --- | ---: | --- | --- | --- |
| `create-payment-intent` | Payment intent API | 5 | Exponential (1s base) | `jobId=create-<orderId>` | DLQ after max attempts |
| `process-webhook` | Webhook receiver | 5 | Exponential (1s base) | `jobId=webhook-<webhookEventId>` | DLQ after max attempts |
| `capture-payment` | Capture fallback flow | 5 | Exponential (1s base) | `jobId=capture-<orderId>` | DLQ after max attempts |
| `expire-orders-sweep` | Scheduler | 3 | Fixed (1s) | stable sweep job id | DLQ after max attempts |
| `reconcile-orders-sweep` | Scheduler | 3 | Fixed (1s) | stable sweep job id | DLQ after max attempts |
| `mock-capture-success` | Mock mode | 3 | Fixed (1s) | derived from order + gateway ids | DLQ after max attempts |

## Concurrency and Idempotency Controls

| Concern | Mechanism | Where |
| --- | --- | --- |
| Duplicate payment-intent requests | Redis distributed lock (`lock:order:intent:<orderId>`) | Order intent handler |
| Concurrent webhook processing | Redis distributed lock (`lock:webhook:event:<eventId>`) | Webhook receive/worker flow |
| Lost update race | DB row lock (`SELECT ... FOR UPDATE`) | Order/Webhook transactional updates |
| Duplicate queue jobs | Deterministic BullMQ `jobId` | Queue service enqueue layer |
| Duplicate webhook events | `ProcessedEvent(eventId)` idempotency marker | Webhook processing flow |
| Retry safety | State-machine checks before status transition | Handlers/services |

## How to Run (Step-by-Step)

| Step | Command | Purpose |
| --- | --- | --- |
| 1 | `docker compose up -d --build` | Start frontend, backend, postgres, redis, adminer |
| 2 | `docker compose logs -f backend` | Follow backend logs |
| 3 | `docker compose logs -f frontend` | Follow frontend logs |
| 4 | `docker compose exec backend npm run prisma:deploy` | Apply migrations in container |
| 5 | `docker compose exec backend npm run db:seed` | Seed sample data |
| 6 | `docker compose down` | Stop services |
| 7 | `docker compose down -v` | Stop and clean volumes |

## Payment Status Model

| Status                                          | Meaning                            |
| ----------------------------------------------- | ---------------------------------- |
| `UNPAID`                                        | Order created; payment not started |
| `PROCESSING`                                    | Payment in progress                |
| `PAID`                                          | Payment successful                 |
| `FAILED`                                        | Payment failed                     |
| `CANCELLED`                                     | Payment cancelled                  |
| `EXPIRED`                                       | Processing timeout reached         |
| `REFUNDING` / `PARTIALLY_REFUNDED` / `REFUNDED` | Reserved refund lifecycle          |

## APIs (Quick Reference)

- `POST /orders` create order
- `POST /orders/:id/payment-intent` start or retry checkout
- `GET /orders/:id` fetch current order status
- `POST /orders/:id/capture` enqueue capture fallback
- `POST /webhooks/paypal` receive payment webhook
- `GET /ops/metrics` queue/worker metrics
- `GET /ops/dlq?limit=20` inspect dead-letter jobs
- `POST /ops/dlq/:jobId/replay` replay failed job

## Local Setup

### Option A: Docker Compose (recommended)

```bash
docker compose up --build
```

Docker commands:

```bash
# Start all services in background
docker compose up -d --build

# View logs
docker compose logs -f

# Stop services
docker compose down

# Stop services and remove volumes
docker compose down -v
```

Services:

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:3000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Adminer: `http://localhost:8081`

### Option B: Run locally without Docker

1. Prepare env files from examples:
   - `backend/.env.example` -> `backend/.env`
   - `apps/web/.env.example` -> `apps/web/.env.local`
2. Install dependencies:

```bash
cd backend && npm install
cd ../apps/web && npm install
```

3. Start backend (default `3000`):

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

4. Start frontend:

```bash
cd apps/web
npm run dev
```

Port note: frontend dev script also uses `3000`. Run one service on a different port (for example set backend `PORT=3001` in `backend/.env`), then align `NEXT_PUBLIC_API_BASE_URL` accordingly.

## Prisma Commands

Run these inside `backend`:

```bash
# Generate Prisma client after schema changes
npm run prisma:generate

# Create and apply a development migration
npm run prisma:migrate

# Apply migrations in deployment/runtime environment
npm run prisma:deploy

# Seed database
npm run db:seed
```

## Environment Variables

### Backend (`backend/.env`)

Required core variables:

- `DATABASE_URL`
- `BULLMQ_REDIS_HOST`
- `BULLMQ_REDIS_PORT`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_SECRET_KEY`
- `PAYPAL_WEBHOOK_ID`
- `FRONTEND_BASE_URL`
- `APP_BASE_URL`

Mock mode variables:

- `MOCK_PAYMENT_GATEWAY=true|false`
- `MOCK_WEBHOOK_SECRET`
- `MOCK_CAPTURE_DELAY_MS`

Operational controls:

- `ORDER_PROCESSING_EXPIRE_MS`
- `ORDER_EXPIRE_SWEEP_EVERY_MS`

### Frontend (`apps/web/.env.local`)

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_PAYPAL_SUPPORTED_CURRENCIES`

## Operational Recovery

- Failed jobs are published to `payment-dlq-queue` after retry exhaustion.
- `/ops/dlq` endpoints allow inspection and replay.
- `/ops/metrics` exposes queue counts for incident triage.

## Module Generator

Create a standardized backend module:

```bash
cd backend
npm run gen:module -- <module-name>
```

Generated skeleton includes:

- `*.module.ts`
- `*.service.ts`
- `cqrs/index.ts`
- `application/commands`
- `application/handlers`

## Quality Commands

### Backend

```bash
cd backend
npm run lint
npm test
```

### Frontend

```bash
cd apps/web
npm run lint
```
