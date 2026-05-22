# Payment Webhook — Frontend

Next.js checkout UI for the PaymentWebhook demo. Creates orders with line items, starts payment, polls status, and shows payment history.

**Related docs:** [Project README](../../README.md) · [Payment & inventory flow](../../docs/paymentflow.md) · [Backend seeder](../../backend/prisma/README.md)

---

## Table of contents

- [Quick start](#quick-start)
- [Tech stack](#tech-stack)
- [Project layout](#project-layout)
- [Checkout flow](#checkout-flow)
- [API integration](#api-integration)
- [Environment variables](#environment-variables)
- [PayPal return pages](#paypal-return-pages)
- [Commands](#commands)
- [Docker](#docker)

---

## Quick start

### With Docker (recommended)

From repo root:

```bash
docker compose up --build
docker compose exec backend npm run db:seed   # if DB is empty
```

Open **http://localhost:8080** (container maps host `8080` → app port `3000`).

### Local dev

```bash
cp .env.example .env.local
npm install
npm run dev
```

Default dev URL: **http://localhost:3000**

> Port clash: backend also uses `3000`. Either run backend on `PORT=3001` or frontend on another port (`next dev -p 3001`) and set `NEXT_PUBLIC_API_BASE_URL` to match the backend.

---

## Tech stack

| Tool | Version / role |
| ---- | -------------- |
| Next.js 16 | App Router |
| React 19 | UI |
| TypeScript | Strict typing |
| Tailwind CSS 4 | Styling |
| Zod | API response validation |

---

## Project layout

```text
apps/web/
├── app/
│   ├── page.tsx              # Checkout page (cart + pay)
│   ├── layout.tsx
│   ├── globals.css
│   └── paypal/
│       ├── complete/page.tsx # Return URL after approval
│       └── cancelled/page.tsx
└── features/
    ├── payment/
    │   ├── services/payment.service.ts  # Orders + payment API
    │   ├── hooks/                       # usePayment, useOrdersHistory
    │   ├── schemas.ts                   # Zod schemas
    │   └── components/                  # Table, buttons, status card
    └── shared/
        ├── services/api-client.ts       # fetch + error handling
        └── lib/env.ts                   # NEXT_PUBLIC_* helpers
```

---

## Checkout flow

What the home page (`app/page.tsx`) does:

| Step | UI action | Backend call |
| ---- | --------- | ------------ |
| 1 | User adjusts qty / currency | (client only) |
| 2 | Click checkout | `POST /orders` with `items` + `amount` |
| 3 | Auto-continue | `POST /orders/:id/payment-intent` |
| 4 | Mock or PayPal | Poll `GET /orders/:id` for `approvalUrl` |
| 5 | Pay in popup / redirect | Gateway webhook updates status (async) |
| 6 | Complete / cancel routes | Refresh status from API |

**Demo SKUs** (seeded via `backend/prisma/seeder/product.seeder.ts`):

| Display name | `sku` |
| ------------ | ----- |
| Wireless Mouse | `wireless-mouse` |
| USB-C Cable | `usb-c-cable` |
| Laptop Stand | `laptop-stand` |

Stock is reserved on the backend when the order is created (see [inventory flow](../../docs/paymentflow.md)).

---

## API integration

All calls go through `features/shared/services/api-client.ts` → `env.apiBaseUrl` + path.

| Function | Endpoint | Purpose |
| -------- | -------- | ------- |
| `createOrder` | `POST /orders` | Order + line items |
| `createPaymentIntent` | `POST /orders/:id/payment-intent` | Start checkout |
| `getOrderStatus` | `GET /orders/:id` | Poll status / URL |
| `capturePayment` | `POST /orders/:id/capture` | Manual capture (if needed) |
| `getOrders` | `GET /orders` | Payment history table |

Responses are validated with Zod schemas in `features/payment/schemas.ts`.

---

## Environment variables

Copy `.env.example` → `.env.local`:

| Variable | Example | Purpose |
| -------- | ------- | ------- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:3000` | Backend base URL (browser-side) |
| `NEXT_PUBLIC_PAYPAL_SUPPORTED_CURRENCIES` | `MYR` | Currency dropdown options |

**Docker Compose** injects `NEXT_PUBLIC_API_BASE_URL` at build time so the browser can reach the host-mapped backend port.

---

## PayPal return pages

| Route | When |
| ----- | ---- |
| `/paypal/complete` | Customer approved payment |
| `/paypal/cancelled` | Customer cancelled at PayPal |

These pages notify the opener window (`postMessage`) so the checkout page can refresh order status.

---

## Commands

```bash
npm run dev          # Dev server (port 3000)
npm run build        # Production build
npm run start        # Run production build
npm run lint         # ESLint
npm run format       # Prettier write
npm run format:check # Prettier check
```

---

## Docker

Built from `apps/web/Dockerfile`. Compose service exposes **8080** on the host.

```bash
# From repo root
docker compose up -d frontend
docker compose logs -f frontend
```

Rebuild after env changes that affect `NEXT_PUBLIC_*` (they are baked in at build time).
