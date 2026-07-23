# Frontend (checkout UI)

Next.js app for browsing products, creating orders, and paying (PayPal popup or mock flow).

- **API settings:** `backend/.env` (Nest server)
- **UI settings:** `apps/web/.env` (this app)

**Related:** [Project README](../../README.md) · [Payment flow](../../docs/paymentflow.md)

---

## Quick start

**1. Start the API first** (from `backend/`):

```bash
cp .env.example .env
npm run start:dev
```

Or use Docker: see [backend/README.md](../../backend/README.md).

**2. Start the UI** (from `apps/web/`):

```bash
cp .env.example .env
npm install
npm run dev
```

Open **http://localhost:8080**.

---

## Env vars

| Variable                                  | Default                 | What it does               |
| ----------------------------------------- | ----------------------- | -------------------------- |
| `NEXT_PUBLIC_API_BASE_URL`                | `http://localhost:3000` | Where the Nest API lives   |
| `NEXT_PUBLIC_PAYPAL_SUPPORTED_CURRENCIES` | `MYR`                   | Currencies shown in the UI |

If checkout fails with network errors, this URL is usually wrong or the backend isn’t running.

---

## Commands

```bash
npm run dev      # local dev server (port 8080)
npm run build    # production build
npm run lint     # ESLint
```
