# Documentation

Guides for the PaymentWebhook project. Start with the root [README](../README.md) for setup and APIs.

| Document | What it covers |
| -------- | -------------- |
| [Payment & inventory flow](./paymentflow.md) | End-to-end checkout, payment, webhook, and stock reservation |
| [App config](../backend/src/config/README.md) | Centralized env / `AppConfigService` |
| [Inventory module](../backend/src/modules/inventory/README.md) | Stock reservation, ledger, CQRS |
| [Frontend (Next.js)](../apps/web/README.md) | Checkout UI, API client, env, local dev |
| [Queue module](../backend/src/modules/queue/README.md) | BullMQ jobs, CQRS handlers, how to add a new worker |

## Quick links

- Local stack: `docker compose up --build` from repo root
- Backend API: `http://localhost:3000`
- Frontend: `http://localhost:8080`
- Inventory: `GET /inventory/products`
