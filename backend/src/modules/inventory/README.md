# Inventory module

ERP / e-commerce **reserve stock** flow with persistent `StockReservation` rows (never delete on confirm).

**Layering:** `Controller` → `Query` / `Command` → `Handler` → `Service` → `Repository`

Cross-module callers use **`InventoryService`** inside shared DB transactions.

---

## Data model

### `Product` (inventory)

| ERP | DB | Formula |
| --- | -- | ------- |
| `total_stock` | `stock` | Physical on-hand |
| `reserved_stock` | `reservedStock` | Locked qty |
| `available_stock` | — | `stock - reservedStock` |

### `StockReservation` (audit + hold) — never `DELETE`

| Field | Purpose |
| ----- | ------- |
| `orderId`, `productId`, `sku`, `quantity` | Who / what / how much |
| `status` | See lifecycle below |
| `reservedAt` | When hold was created |
| `confirmedAt` | Payment success |
| `releasedAt` | Fail / cancel release |
| `expiredAt` | TTL sweep |
| `restockedAt` | Refund restock |
| `expiresAt` | Active hold TTL |
| `reservationKey` | Idempotency (`reserve:{orderId}:{sku}`) |

**Enterprise rule:** `UPDATE status → CONFIRMED` — **not** `DELETE FROM stock_reservations`.  
`Order` delete is `RESTRICT` so audit rows are not cascade-wiped.

**Lifecycle:**

```text
RESERVED → CONFIRMED → FULFILLED   (optional shipping step)
RESERVED → RELEASED | EXPIRED      (fail / cancel / timeout)
CONFIRMED → RESTOCKED              (refund)
```

Archive old rows later with cron if the table grows.

### `StockLedgerEntry` (`inventory_transactions`)

Append-only: `RESERVE` | `EXTEND` | `CONFIRM` | `RELEASE` | `EXPIRE` | `RESTOCK`  
(Legacy rows may read `COMMIT` / `RESTORE_REFUND`.)

---

## Flow

| Step | Service | Reservation status | `total_stock` | `reserved_stock` |
| ---- | ------- | -------------------- | ------------- | ---------------- |
| Create order | `reserveAtCheckout` | `RESERVED` | unchanged | ↑ |
| Payment pending | `extendForPayment` | `RESERVED` | unchanged | unchanged |
| Payment success | `commitForOrder` | **`CONFIRMED`** | ↓ | ↓ |
| Fail / cancel | `releaseForOrder` | **`RELEASED`** | unchanged | ↓ |
| TTL sweep | `expireStaleReservations` | **`EXPIRED`** | unchanged | ↓ |

### Numeric example (must match)

| Type | Before pay | After pay success |
| ---- | ---------- | ----------------- |
| Physical stock (`total_stock`) | 100 | **90** |
| Reserved (`reserved_stock`) | 10 | **0** |
| Available | 90 | **90** |

Executable spec: `inventory.snapshot.spec.ts`

---

## Concurrency

- DB transaction per order / SKU batch
- `SELECT … FOR UPDATE` on `Product`
- Optimistic `version` on `Product`
- Redis `lock:inventory:sku:{sku}`
- SKUs locked in sorted order
- Queue-driven payment + webhook workers

---

## CQRS surface

| Type | Name | Used by |
| ---- | ---- | ------- |
| Query | `ListProductsQuery` | `GET /inventory/products` |
| Query | `ListOrderReservationsQuery` | `GET /inventory/orders/:orderId/reservations` |
| Command | `ExpireStaleReservationsCommand` | Queue sweep |
| Command | `ExpireUnpaidOrdersCommand` | Queue sweep |

Transactional API: `reserveAtCheckout`, `extendForPayment`, `commitForOrder`, `fulfillForOrder`, `releaseForOrder`, `restoreForRefund`.

## Production guarantees

| Layer | Mechanism |
| ----- | --------- |
| DB | `CHECK (stock >= 0)`, `CHECK (reservedStock >= 0)`, `CHECK (reservedStock <= stock)` |
| DB | `CHECK (status IN ('RESERVED',…,'RESTOCKED'))` |
| App | `assertProductInventoryInvariant` after each mutation |
| Concurrency | `SELECT FOR UPDATE`, `version`, Redis SKU locks, sorted SKU order |
| Audit | Rows never `DELETE`; `ON DELETE RESTRICT` on `orderId` |
| Ledger | Append-only `StockLedgerEntry` (`RESERVE`, `CONFIRM`, `RELEASE`, `RESTOCK`, …) |

---

## Related docs

- [Payment & inventory flow](../../../docs/paymentflow.md)
- [Queue module](../queue/README.md)
- [Prisma schema](../../../prisma/README.md)
