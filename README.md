# Payment Webhook

A small demo app that shows how to run **payments + inventory** the way many production shops do: webhooks that can be retried safely, stock held at checkout, background workers for slow work, and tools to recover when things get stuck.

**More detail:** [Payment flow](./docs/paymentflow.md) · [Backend](./backend/README.md) · [Frontend](./apps/web/README.md) · [Database](./backend/prisma/README.md) · [Config](./backend/src/common/config/README.md) · [Infrastructure](./backend/src/infrastructure/README.md)

---

## Quick start

Pick one way to run things.

### Option A — Backend in Docker (easiest)

From the `backend/` folder (this starts Postgres, Redis, and the API for you):

```bash
cd backend
cp .env.example .env
docker compose up --build
docker compose exec backend npm run db:seed
```

- API: http://localhost:3000  
- Frontend: still on your machine — `cd apps/web && npm run dev`, then open http://localhost:8080  

See [backend/README.md](./backend/README.md) for Docker tips.

### Option B — Everything on your machine

You need **Node.js 20+**, **PostgreSQL**, and **Redis**.

**1. Backend env**

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`: set `DATABASE_URL`, PayPal keys if you want real checkout, and `MOCK_PAYMENT_GATEWAY=false` for the PayPal popup flow.

**2. Frontend env**

```bash
cp apps/web/.env.example apps/web/.env
```

`NEXT_PUBLIC_API_BASE_URL` should point at the API (default `http://localhost:3000`).

**3. Start backend**

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
npm run start:dev
```

**4. Start frontend** (new terminal)

```bash
cd apps/web
npm install
npm run dev
```

Open http://localhost:8080. API lives at http://localhost:3000.

Quick sanity check:

```bash
curl http://localhost:3000/inventory/products
```

---

## Where things run

| What        | URL                     | How to start                          |
| ----------- | ----------------------- | ------------------------------------- |
| Frontend    | http://localhost:8080   | `cd apps/web && npm run dev`          |
| Backend API | http://localhost:3000   | `cd backend && npm run start:dev`     |
| PostgreSQL  | localhost:5432          | `DATABASE_URL` in `backend/.env`      |
| Redis       | localhost:6379          | `BULLMQ_REDIS_*` in `backend/.env`    |

---

## What you’ll learn from this repo

- **Slow work off the HTTP thread** — checkout and webhooks run in BullMQ workers.
- **Webhooks you can replay** — verify signature, store the event, process once even if PayPal sends it twice.
- **Inventory that doesn’t oversell** — reserve at order time, commit when paid, release on failure or timeout.
- **Things that fix themselves** — scheduled jobs expire stuck payments and old holds.
- **Ops hooks** — dead-letter queue, replay, basic queue metrics.

---

## Tech stack

| Part     | Tools                                                     |
| -------- | --------------------------------------------------------- |
| Backend  | NestJS 11, CQRS, BullMQ, Prisma 5, PostgreSQL, Redis, Zod |
| Frontend | Next.js 16, React 19, Tailwind CSS 4                      |
| Tooling  | ESLint, Prettier, Jest, Husky                               |

---

## Repo layout (bird’s-eye view)

```text
PaymentWebhook/
├── backend/          # Nest API, workers, Prisma
├── apps/web/         # Checkout UI
└── docs/             # Flow diagrams and notes
```

Inside the backend, code is grouped as:

- **`common/`** — config and shared HTTP helpers (no PayPal/Redis here)
- **`infrastructure/`** — database, Redis, queues, PayPal adapter, locks
- **`modules/`** — orders, payments, webhooks, inventory (your business rules)

A typical request: **Controller**, then **Command/Query**, then **Handler**, then **Service** (Prisma lives in services; there’s no separate repository layer).

Modules are wired in `backend/src/modules/feature-modules.ts`.

---

## How inventory works (short version)

We don’t subtract stock at “add to cart.” We **reserve** it:

`available = total_stock - reserved_stock`

Reservation rows stay in the DB for audit (status moves from `RESERVED` to `CONFIRMED`; we don’t delete them).

| Moment              | What happens              | Reserved | Available | Total on hand |
| ------------------- | ------------------------- | -------- | --------- | ------------- |
| Create order        | Hold stock                | ↑        | ↓         | same          |
| Paying              | Still held                | same     | same      | same          |
| Paid                | Sale completes            | to 0     | same      | ↓ (sold)      |
| Fail / cancel / TTL | Hold released             | ↓        | ↑         | same          |

Example: 100 in the warehouse, customer reserves 10, so 90 available. After payment: 90 on hand, 0 reserved, 90 available.

Deeper dive: [docs/paymentflow.md](./docs/paymentflow.md) · [inventory module](./backend/src/modules/inventory/README.md)

---

## Payment flow (short version)

1. **Create order** — `UNPAID`; stock reserved if you send `items`.
2. **Payment intent** — extends the hold; enqueues checkout work.
3. **Worker** — talks to PayPal (or mock); saves `approvalUrl`.
4. **Customer pays** — UI polls `GET /orders/:id`.
5. **Webhook** — verified, stored, processed in a worker; order becomes `PAID`, `FAILED`, etc.
6. **Sweeps** — background jobs clean up expired payments, holds, and abandoned carts.

---

## Main API endpoints

| Method | Path                                      | What it does                    |
| ------ | ----------------------------------------- | ------------------------------- |
| `POST` | `/orders`                                 | Create order (`Idempotency-Key` optional) |
| `POST` | `/orders/:id/payment-intent`              | Start or retry checkout         |
| `GET`  | `/orders/:id`                             | Order status and events         |
| `GET`  | `/orders`                                 | List orders (cursor pagination) |
| `POST` | `/orders/:id/capture`                     | Capture fallback                |
| `POST` | `/webhooks/paypal`                        | PayPal webhook intake           |
| `GET`  | `/inventory/products`                     | Stock per SKU                   |
| `GET`  | `/inventory/orders/:orderId/reservations` | Reservation history             |
| `GET`  | `/ops/metrics`                            | Queue health                    |
| `GET`  | `/ops/dlq`                                | Failed jobs                     |
| `POST` | `/ops/dlq/:jobId/replay?queue=`           | Replay a failed job             |

**Sample create-order body:**

```json
{
  "amount": 64.9,
  "currency": "MYR",
  "items": [
    { "sku": "wireless-mouse", "quantity": 1, "unitPrice": 39.9 },
    { "sku": "usb-c-cable", "quantity": 2, "unitPrice": 12.5 }
  ]
}
```

---

## Order statuses

| Status        | Meaning                              |
| ------------- | ------------------------------------ |
| `UNPAID`      | Created; stock may be reserved       |
| `PROCESSING`  | Checkout in progress                 |
| `PAID`        | Paid; stock committed                |
| `FAILED`      | Payment failed                       |
| `CANCELLED`   | Cancelled at the gateway             |
| `EXPIRED`     | Timed out                            |
| `REFUND*`     | Refund in progress or done           |

---

## Background jobs

| Job                          | Why it exists                         |
| ---------------------------- | ------------------------------------- |
| `create-payment-intent`      | Open PayPal / mock checkout           |
| `process-webhook`            | Apply payment result + inventory      |
| `capture-payment`            | Manual capture fallback               |
| `expire-orders-sweep`        | Stuck `PROCESSING` orders             |
| `expire-reservations-sweep`  | Holds past TTL                        |
| `expire-unpaid-orders-sweep` | Abandoned checkouts                    |
| `reconcile-orders-sweep`     | Compare gateway vs our DB             |
| `mock-capture-success`       | Auto-complete mock payments           |

Retries: payment/webhook jobs try ~5 times with backoff; sweeps try ~3 times with a short fixed delay. Details: [queue README](./backend/src/infrastructure/queue/README.md).

---

## Staying safe under load (locks & idempotency)

| Problem                    | How we handle it                          |
| -------------------------- | ----------------------------------------- |
| Double create order        | Optional `Idempotency-Key` header + unique DB key |
| Double payment intent      | Redis lock per order                      |
| Duplicate webhook          | `ProcessedEvent` + lock per event id      |
| Two requests, one row      | `SELECT … FOR UPDATE` via `RowLockService` |
| Duplicate queue job        | Stable BullMQ `jobId`                     |
| Permanent vs transient job | 4xx → `UnrecoverableError` (no retry); 5xx/network → retry |
| Double reserve same line   | `reservationKey` per order + SKU          |
| Hot SKU                    | Redis lock per SKU                        |

---

## Environment variables

All backend settings are loaded in **`backend/src/common/config/`** — use `AppConfigService` in code instead of raw `process.env`. See the [config README](./backend/src/common/config/README.md).

```bash
cp backend/.env.example backend/.env
cp apps/web/.env.example apps/web/.env
```

**Real PayPal (sandbox):**

1. Create a sandbox app at [PayPal Developer](https://developer.paypal.com/dashboard/applications/sandbox).
2. In `backend/.env`:

```env
MOCK_PAYMENT_GATEWAY=false
PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
PAYPAL_CLIENT_ID=<your-sandbox-client-id>
PAYPAL_SECRET_KEY=<your-sandbox-secret>
PAYPAL_CURRENCY=MYR
FRONTEND_BASE_URL=http://localhost:8080
```

3. Restart the backend, open http://localhost:8080, allow popups for PayPal.
4. After paying, `/paypal/complete` polls status and can capture if webhooks aren’t set up locally.

**Mock mode (no PayPal account):** `MOCK_PAYMENT_GATEWAY=true` plus `MOCK_WEBHOOK_SECRET` and `MOCK_CAPTURE_DELAY_MS`.

**Timeouts** (defaults in `.env.example`): `ORDER_PROCESSING_EXPIRE_MS`, `STOCK_RESERVATION_TTL_MS`, `UNPAID_ORDER_EXPIRE_MS`, and their sweep intervals.

**Frontend:** `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_PAYPAL_SUPPORTED_CURRENCIES`.

---

## Database commands

From `backend/`:

```bash
npm run prisma:generate   # after schema changes
npm run prisma:migrate      # dev: create + apply migration
npm run prisma:deploy       # prod: apply existing migrations only
npm run db:seed             # demo products + sample order
```

Schema and seeds: [backend/prisma/README.md](./backend/prisma/README.md). Runtime client: `backend/src/infrastructure/database/prisma/`.

---

## When jobs fail

- After max retries, failed jobs stay in BullMQ (dead-letter set; keep last `BULLMQ_REMOVE_ON_FAIL`).
- `GET /ops/dlq` — list failed jobs (`?limit=50&queue=audit-queue` optional).
- `POST /ops/dlq/:jobId/replay?queue=audit-queue` — retry one failed job.
- `GET /ops/metrics` — waiting / active / delayed / failed counts.

## Rate limiting

Global Nest throttler (tracker = `x-api-key` header, else client IP):

| Scope | Env | Default |
| ----- | --- | ------- |
| All routes | `RATE_LIMIT_LIMIT` / `RATE_LIMIT_TTL_MS` | 120 / 60s |
| Create order, payment-intent, capture | `RATE_LIMIT_PAYMENT_*` | 30 / 60s |
| PayPal webhook | `RATE_LIMIT_WEBHOOK_*` | 180 / 60s |

`/ops/*` skips throttling. Over limit returns HTTP `429`.

---

## Development

**New backend module:**

```bash
cd backend
npm run gen:module -- <module-name>
```

**Lint & test:**

```bash
cd backend && npm run lint && npm test
cd apps/web && npm run lint
```

Tests live in `backend/src/**/*.spec.ts`.
