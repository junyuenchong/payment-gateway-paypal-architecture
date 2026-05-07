# PaymentWebhook

Production-style payment webhook service built with NestJS + Next.js + PostgreSQL.

## What this project demonstrates (production style)

- Async payment checkout creation (BullMQ workers, idempotent, retry-safe)
- Webhook signature verification + event table (`WebhookEvent`, `ProcessedEvent`)
- Strong consistency on status updates (DB transaction + row lock + Redis distributed lock)
- Clear state machine for payment lifecycle (including `EXPIRED` and safe retries)
- Dead-letter queue with replay (`payment-dlq-queue` + `/ops` endpoints)
- Frontend payment status table for intent vs live status (for observability)
- **No side-effect notifications** (focus is on payment status only)

## Quick payment flow

1. Frontend creates order: `POST /orders`
2. Frontend requests payment intent: `POST /orders/:id/payment-intent`
3. Backend marks order as `PROCESSING` and enqueues checkout job
4. Worker creates PayPal checkout, stores `paypalOrderId` + `approvalUrl`
5. Frontend polls `GET /orders/:id` until `approvalUrl` exists, then opens PayPal popup
6. PayPal sends webhook: `POST /webhooks/paypal`
7. Backend verifies signature, persists event, enqueues webhook-processing job
8. Worker updates final order status (`PAID` / `FAILED` / `CANCELLED`)
9. If order stays `PROCESSING` too long, maintenance worker marks it `EXPIRED`

## Visual workflow (interview board style)

```text
┌────────────────────── PRODUCTION PAYMENT WORKFLOW ──────────────────────┐
│ Frontend         Backend API              Queue Worker         Gateway    │
├───────────────────────────────────────────────────────────────────────────┤
│ 1) POST /orders  ───────────────▶  create order (UNPAID)                │
│                                                                           │
│ 2) POST /orders/:id/payment-intent + Idempotency-Key                     │
│                      └──────────▶ set PROCESSING + enqueue create-intent │
│                                              │                           │
│                                              ▼                           │
│                                   create checkout (retry x5)             │
│                                   backoff: exponential 1s base           │
│                                              │                           │
│                                save paypalOrderId + approvalUrl          │
│                                              │                           │
│ 3) poll GET /orders/:id ◀────────────────────┘                           │
│    timeout: 90s, interval: 2s                                             │
│    approvalUrl ready -> open PayPal popup                                 │
│                                              │                           │
│                                              ▼                           │
│                                      user pays in PayPal                  │
│                                              │                           │
│ 4) webhook POST /webhooks/paypal ◀───────────┘                           │
│    verify signature + idempotency check (ProcessedEvent.eventId)          │
│    persist WebhookEvent + enqueue webhook job (retry x5, exp 1s)          │
│                                              │                           │
│                                              ▼                           │
│                                   row-lock update status                  │
│                                   terminal: PAID / FAILED / CANCELLED     │
│                                                                           │
│                         (background) expire sweep:                         │
│                         PROCESSING too long -> EXPIRED                     │
└───────────────────────────────────────────────────────────────────────────┘
```

Combined flow summary:

- `POST /orders` creates `UNPAID`
- `POST /orders/:id/payment-intent` sets `PROCESSING` and enqueues checkout worker
- Worker stores `paypalOrderId + approvalUrl`
- Frontend polls `GET /orders/:id` and opens popup when `approvalUrl` is ready
- PayPal sends webhook to `/webhooks/paypal`
- Backend verifies signature and enqueues webhook worker
- Worker updates final status: `PAID` / `FAILED` / `CANCELLED`
- Maintenance worker expires stuck orders: `PROCESSING` -> `EXPIRED`

## Payment statuses

| Status                                          | Meaning                                      |
| ----------------------------------------------- | -------------------------------------------- |
| `UNPAID`                                        | Order created, payment not started           |
| `PROCESSING`                                    | Payment started / waiting for gateway result |
| `EXPIRED`                                       | Processing timed out (no final gateway result) |
| `PAID`                                          | Payment successful                           |
| `FAILED`                                        | Payment failed                               |
| `CANCELLED`                                     | Payment cancelled                            |
| `REFUNDING` / `PARTIALLY_REFUNDED` / `REFUNDED` | Reserved for refund flow                     |

UI note:

- `Pay Again` is hidden for `PAID`, `REFUNDED`, and `PARTIALLY_REFUNDED`.

State transitions (simplified):

```text
UNPAID -> PROCESSING
PROCESSING -> PAID | FAILED | CANCELLED | EXPIRED
PAID -> REFUNDING -> REFUNDED | PARTIALLY_REFUNDED
FAILED/CANCELLED -> PROCESSING (Pay Again retry)
EXPIRED -> PROCESSING (Pay Again retry)
```

## Retry and timeout policy (exact numbers)

### Server-side retries (BullMQ)

| Flow                  | Queue / job                                               | Enqueue location                                                                      | Attempts | Backoff                  | Dedupe                           | Failed jobs kept |
| --------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------: | ------------------------ | -------------------------------- | ---------------: |
| Create checkout       | `create-payment-intent-queue` / `create-payment-intent`   | `backend/src/modules/orders/application/handlers/create-payment-intent.handler.ts`    |        5 | exponential, 1000ms base | `jobId=create-<orderId>`         |              100 |
| Process webhook       | `payment-webhook-process-queue` / `process-webhook-event` | `backend/src/modules/webhooks/application/handlers/receive-webhook.handler.ts`        |        5 | exponential, 1000ms base | `jobId=webhook-<webhookEventId>` |              100 |
| Capture fallback      | `capture-payment-queue` / `capture-payment`               | `backend/src/modules/orders/application/handlers/schedule-capture-payment.handler.ts` |        5 | exponential, 1000ms base | `jobId=capture-<orderId>`        |              100 |
| Expire processing     | `order-maintenance` / `expire-orders-sweep`               | `backend/src/modules/orders/order-expiry.scheduler.ts`                                |        3 | fixed, 1000ms            | `jobId=expire-orders-sweep`      |               50 |
| Mock webhook delivery | `mock-payment-queue` / `mock-capture-success`             | `backend/src/modules/payments/mock-payment.scheduler.ts`                              |        3 | fixed, 1000ms            | N/A                              |               50 |

DLQ note: This project now uses a dedicated DLQ queue: `payment-dlq-queue`.

- On final retry failure (`attemptsMade >= attempts`), workers publish failed jobs to DLQ.
- Source queues keep `removeOnFail` history for local debugging.
- DLQ payload includes source queue/job, attempts made, configured attempts, reason, and original payload.

### Client-side polling and timeout

| Purpose                | File                                           | Interval | Timeout |
| ---------------------- | ---------------------------------------------- | -------: | ------: |
| Wait for `approvalUrl` | `apps/web/app/page.tsx` (`waitForApprovalUrl`) |       2s |     90s |
| Poll order status      | `apps/web/app/page.tsx` (`startStatusPolling`) |       2s |     90s |

## MUST HAVE checklist

- ✅ Idempotency keys (`ProcessedEvent.eventId`, BullMQ `jobId`, `Order.idempotencyKey`)
- ✅ Webhook verification (`webhook-signature.service.ts`)
- ✅ DB transaction (`prisma.$transaction`)
- ✅ Row locking (`SELECT ... FOR UPDATE`)
- ✅ Redis distributed lock (`SET NX + TTL`, token-safe release)
- ✅ Retry-safe processing (BullMQ `attempts` + `backoff` + idempotent checks)
- ✅ Queue workers (intent, webhook, capture)
- ✅ State machine style status guardrails (no invalid regressions)
- ✅ Event table (`WebhookEvent`, `ProcessedEvent`)
- ✅ Timeout handling (frontend 90s timeout + server-side PROCESSING -> EXPIRED)
- ✅ Dead-letter queue (dedicated `payment-dlq-queue`)

## Ops monitoring and recovery (interview demo)

- `GET /ops/metrics`
  - Returns BullMQ queue counts (`waiting`, `active`, `completed`, `failed`, `delayed`)
  - Queues included: create-intent, capture, webhook-process, DLQ
- `GET /ops/dlq?limit=20`
  - Lists pending DLQ jobs and original failure payload
- `POST /ops/dlq/:jobId/replay`
  - Re-enqueues the failed payload back to the original source queue
  - Removes the DLQ job after replay succeeds

Suggested demo flow:

1. Trigger a failed payment path (or temporary gateway failure).
2. Show non-zero failures in `GET /ops/metrics`.
3. Inspect failure details in `GET /ops/dlq`.
4. Run replay with `POST /ops/dlq/:jobId/replay`.
5. Re-check `GET /ops/metrics` and order status recovery.

### DLQ demo steps (short)

1. `POST /orders` → create a new order.
2. `POST /orders/:id/capture` on an order that is not fully paid yet (will fail and go to DLQ after retries).
3. `GET /ops/metrics` and `GET /ops/dlq?limit=20` → show failed job and payload.
4. `POST /ops/dlq/:jobId/replay` → manually replay after you “fixed” the issue.
5. `GET /ops/metrics` again → show that the DLQ job count drops and business queue is re-processed.

### Where locks are used

#### Redis distributed lock (`SET NX + TTL`)

| Flow                  | Handler                                                                               | Lock key pattern               | Purpose                                                                    |
| --------------------- | ------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| Create payment intent | `backend/src/modules/orders/application/handlers/create-payment-intent.handler.ts`    | `lock:order:intent:<orderId>`  | Prevent concurrent duplicate intent requests across multiple app instances |
| Capture scheduling    | `backend/src/modules/orders/application/handlers/schedule-capture-payment.handler.ts` | `lock:order:capture:<orderId>` | Prevent duplicate capture scheduling race                                  |
| Webhook receive       | `backend/src/modules/webhooks/application/handlers/receive-webhook.handler.ts`        | `lock:webhook:event:<eventId>` | Prevent concurrent duplicate processing for same webhook event id          |

#### DB row lock (`SELECT ... FOR UPDATE`)

| Flow                      | File                                                                               | Locked row                 | Purpose                                              |
| ------------------------- | ---------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------- |
| Create intent state guard | `backend/src/modules/orders/application/handlers/create-payment-intent.handler.ts` | `Order` by `orderId`       | Ensure consistent status check/update before enqueue |
| Create checkout worker    | `backend/src/modules/orders/create-payment-intent.processor.ts`                    | `Order` by `orderId`       | Avoid duplicate `paypalOrderId`/`approvalUrl` writes |
| Capture payment           | `backend/src/modules/orders/application/handlers/capture-payment.handler.ts`       | `Order` by `orderId`       | Ensure single safe status transition during capture  |
| Webhook processing        | `backend/src/modules/webhooks/webhook-process.service.ts`                          | `WebhookEvent` and `Order` | Ensure one webhook worker updates status at a time   |

## Key files

- Orders API: `backend/src/modules/orders/orders.controller.ts`
- Create intent API handler: `backend/src/modules/orders/application/handlers/create-payment-intent.handler.ts`
- Create intent worker: `backend/src/modules/orders/create-payment-intent.processor.ts`
- Capture scheduler: `backend/src/modules/orders/application/handlers/schedule-capture-payment.handler.ts`
- Capture worker/logic: `backend/src/modules/orders/capture-payment.processor.ts`, `backend/src/modules/orders/application/handlers/capture-payment.handler.ts`
- Webhook controller: `backend/src/modules/webhooks/webhooks.controller.ts`
- Webhook signature verifier: `backend/src/modules/webhooks/webhook-signature.service.ts`
- Webhook worker/logic: `backend/src/modules/webhooks/webhook-process.processor.ts`, `backend/src/modules/webhooks/webhook-process.service.ts`
- Redis lock service: `backend/src/modules/locks/redis-lock.service.ts`
- DLQ jobs/service: `backend/src/modules/payments/payment-dlq.jobs.ts`, `backend/src/modules/payments/payment-dlq.service.ts`
- Ops module/controller/service: `backend/src/modules/ops/ops.module.ts`, `backend/src/modules/ops/ops.controller.ts`, `backend/src/modules/ops/ops.service.ts`
- Frontend checkout page: `apps/web/app/page.tsx`

## API quick list (for interview demo)

- `POST /orders` create order
- `POST /orders/:id/payment-intent` start/retry checkout
- `GET /orders/:id` query latest order status (frontend polls this)
- `POST /orders/:id/capture` enqueue capture fallback
- `POST /webhooks/paypal` receive gateway webhook
- `GET /ops/metrics` queue health counters
- `GET /ops/dlq?limit=20` inspect failed jobs
- `POST /ops/dlq/:jobId/replay` replay a failed DLQ job

## 2-minute interview script

1. We create an order as `UNPAID`, then `payment-intent` moves it to `PROCESSING` and enqueues checkout creation.
2. All critical writes are protected by Redis lock + DB row lock (`FOR UPDATE`) to prevent duplicate processing.
3. Gateway callbacks are processed asynchronously through webhook queue with idempotency and retry.
4. Final states are guarded by a status machine (`PAID`, `FAILED`, `CANCELLED`) to avoid invalid regressions.
5. If processing is stuck too long, maintenance worker auto-marks order as `EXPIRED`.
6. On repeated failures, jobs go to DLQ; we can inspect and replay with `/ops/dlq` endpoints.
7. This gives a production-style payment flow: idempotent, retry-safe, observable, and recoverable.

## Environment setup (production-style local)

### Backend (`backend/.env`)

```env
DATABASE_URL="postgresql://payment:payment@localhost:5432/payment"

PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
PAYPAL_CLIENT_ID=your-client-id
PAYPAL_SECRET_KEY=your-secret
PAYPAL_WEBHOOK_ID=your-paypal-webhook-id
PAYPAL_CURRENCY=MYR
PAYPAL_SUPPORTED_CURRENCIES=MYR

FRONTEND_BASE_URL=http://localhost:8080

BULLMQ_REDIS_HOST=localhost
BULLMQ_REDIS_PORT=6379
BULLMQ_REDIS_PASSWORD=

APP_BASE_URL=http://127.0.0.1:3000

MOCK_PAYMENT_GATEWAY=true
MOCK_WEBHOOK_SECRET=replace-with-long-random-string
MOCK_CAPTURE_DELAY_MS=2500

ORDER_PROCESSING_EXPIRE_MS=900000
ORDER_EXPIRE_SWEEP_EVERY_MS=60000
```

### Frontend (`apps/web/.env.local`)

```env
NEXT_PUBLIC_PAYPAL_SUPPORTED_CURRENCIES=MYR
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

## Mock vs real PayPal

- `MOCK_PAYMENT_GATEWAY=true`
  - Uses mock scheduler + mock signature
  - `PAYPAL_WEBHOOK_ID` can be placeholder
- `MOCK_PAYMENT_GATEWAY=false`
  - Uses real PayPal signature verification API
  - `PAYPAL_WEBHOOK_ID` must be valid
  - Webhook URL must be publicly reachable

## Run with Docker

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:3000`
- Redis: `localhost:6379`
- Adminer: `http://localhost:8081`

### Adminer / DB insight (for interview)

- URL: `http://localhost:8081`
- System: `PostgreSQL`
- Server: `db` (from Docker Compose) or `localhost` (if using local Postgres)
- Database: `payment`
- User / Password: see `DATABASE_URL` in `backend/.env` (default `payment:payment`)

Tables worth showing:

- `Order`
  - Columns: `status`, `paypalOrderId`, `approvalUrl`, `idempotencyKey`, timestamps
  - Demo: how status moves from `UNPAID` → `PROCESSING` → `PAID` / `FAILED` / `CANCELLED` / `EXPIRED`
- `WebhookEvent`
  - Columns: `eventId`, `type`, `status`, `orderId`, `createdAt`, `processedAt`
  - Demo: webhook deliveries and processing lifecycle
- `ProcessedEvent`
  - Columns: `eventId`, `provider`, `processedAt`
  - Demo: webhook idempotency (same `eventId` only processed once)

In an interview, you can open Adminer to show:

1. A new `Order` row being created and moving through statuses.
2. Corresponding `WebhookEvent` rows appearing when the gateway calls back.
3. `ProcessedEvent` proving idempotent handling of external events.
