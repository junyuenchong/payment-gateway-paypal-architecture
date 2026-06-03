# Database schema & migrations

This folder is everything the **Prisma CLI** touches: `schema.prisma`, SQL migrations, and seed scripts.

When the Nest app runs, it uses a separate runtime wrapper at `src/infrastructure/database/prisma/` — same database, different entry point.

Set `DATABASE_URL` in **`backend/.env`** only.

**Docker:** from `backend/`, `docker compose up --build`, then `docker compose exec backend npm run db:seed`. See [backend/README.md](../README.md).

---

## What’s in here

| Path | What it’s for |
| ---- | ------------- |
| `schema.prisma` | Tables and columns (status fields are `String`; app enums live under `src/modules/*/enums/`) |
| `migrations/` | Versioned SQL you apply in order |
| `seeder/` | Scripts that load demo data |

---

## Seeding demo data

From `backend/`:

```bash
npm run db:seed
```

That runs `node prisma/seeder/seed.mjs`, which calls:

| File | Loads |
| ---- | ----- |
| `product.seeder.ts` | Demo SKUs (`wireless-mouse`, `usb-c-cable`, `laptop-stand`) |
| `demo-order.seeder.ts` | One static unpaid order |

**Add your own seeder:** create `seeder/<name>.seeder.ts`, export a `seedX()` function, call it from `main.ts`.

Shared client: `seeder/prisma-client.ts`.

---

## Commands you’ll use

| Command | When |
| ------- | ---- |
| `npm run prisma:generate` | After editing `schema.prisma` |
| `npm run prisma:migrate` | Dev: create a new migration and apply it |
| `npm run prisma:deploy` | Prod/CI: apply migrations that already exist |
| `npm run db:seed` | Refresh demo products and sample order |

---

## Inventory-related migrations

If you’re bringing an old DB up to date, these matter (in order):

| Migration | Adds |
| --------- | ---- |
| `20260522000000_add_inventory` | Products, reservations, line items |
| `20260522100000_production_inventory` | CHECK constraints, ledger, TTL |
| `20260524120000_erp_reservation_statuses` | `RESERVED` / `CONFIRMED`, `productId`, `confirmedAt` |
| `20260524130000_reservation_audit_timestamps` | Audit timestamps, FK RESTRICT |
| `20260524140000_production_inventory_hardening` | Status CHECK, `fulfilledAt`, default `RESERVED` |

---

## Runtime Prisma in Nest

| File | Role |
| ---- | ---- |
| `prisma.module.ts` | Global module in `AppModule` |
| `prisma.service.ts` | Connects on boot |
| `prisma-transaction.service.ts` | `prisma.$transaction` helper |
| `locks/row-lock.service.ts` | `SELECT … FOR UPDATE` |
| `locks/advisory-lock.service.ts` | Postgres advisory locks |

More detail: [infrastructure/database/prisma/README.md](../src/infrastructure/database/prisma/README.md).
