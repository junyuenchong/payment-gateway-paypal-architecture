# Inventory module

Handles **stock reservation** the way many ERP/e-commerce systems do: hold quantity at checkout, confirm on payment, release on failure — and keep reservation rows for audit (we don’t delete them on success).

**Request path:** Controller, then Query/Command, then Handler, then `InventoryService`

Other modules (orders, payments) call `InventoryService` inside the same DB transaction when they need to move stock.

---

## Folder layout

```text
inventory/
├── dto/, enums/
├── helpers/          # invariants, snapshots, small pure helpers
├── cqrs/             # commands, queries, handlers
├── inventory.controller.ts
├── inventory.service.ts
└── inventory.module.ts
```

---

## The numbers that matter

On each **product**:

| Concept | DB field | Meaning |
| ------- | -------- | ------- |
| On hand | `stock` | Physical quantity |
| Held | `reservedStock` | Locked for unpaid orders |
| Sellable | — | `stock - reservedStock` |

Each **reservation row** tracks one order line: SKU, qty, status, timestamps (`reservedAt`, `confirmedAt`, `releasedAt`, …), and `reservationKey` for idempotency (`reserve:{orderId}:{sku}`).

**We don’t `DELETE` reservations** — status moves to `CONFIRMED`, `RELEASED`, `EXPIRED`, etc. Orders use `ON DELETE RESTRICT` so audit history isn’t wiped by mistake.

**Lifecycle:**

```text
RESERVED, then CONFIRMED, then FULFILLED   (optional ship step)
RESERVED, then RELEASED or EXPIRED        (fail / cancel / timeout)
CONFIRMED, then RESTOCKED                  (refund)
```

`StockLedgerEntry` is append-only (`RESERVE`, `CONFIRM`, `RELEASE`, …) for a paper trail.

---

## What happens when (flow)

| Step | Service method | Reservation | `stock` | `reservedStock` |
| ---- | -------------- | ------------- | ------- | --------------- |
| Checkout | `reserveAtCheckout` | `RESERVED` | same | ↑ |
| Paying | `extendForPayment` | `RESERVED` | same | same |
| Paid | `commitForOrder` | `CONFIRMED` | ↓ | ↓ |
| Failed / cancelled | `releaseForOrder` | `RELEASED` | same | ↓ |
| TTL job | `expireStaleReservations` | `EXPIRED` | same | ↓ |

**Example that must always hold:** 100 on hand, reserve 10, so 90 available. After pay: 90 on hand, 0 reserved, 90 available.  
Tests: `helpers/inventory.snapshot.spec.ts`.

---

## Staying correct under concurrency

- One DB transaction per order / SKU batch
- `SELECT … FOR UPDATE` on `Product` via `RowLockService`
- Optimistic `version` on `Product`
- Redis lock `lock:inventory:sku:{sku}`
- SKUs locked in **sorted** order to avoid deadlocks
- Payment + webhook work runs in queue workers, not only on HTTP threads

---

## HTTP & background entry points

| Type | Name | Trigger |
| ---- | ---- | ------- |
| Query | `ListProductsQuery` | `GET /inventory/products` |
| Query | `ListOrderReservationsQuery` | `GET /inventory/orders/:orderId/reservations` |
| Command | `ExpireStaleReservationsCommand` | Reservation sweep job |
| Command | `ExpireUnpaidOrdersCommand` | Unpaid order sweep job |

Service methods other modules call: `reserveAtCheckout`, `extendForPayment`, `commitForOrder`, `fulfillForOrder`, `releaseForOrder`, `restoreForRefund`.

---

## Safety nets

| Layer | What |
| ----- | ---- |
| Database | CHECKs: `stock >= 0`, `reservedStock <= stock`, valid status enum |
| App | `assertProductInventoryInvariant` after mutations |
| Audit | No hard deletes; ledger append-only |

---

## More reading

- [Payment & inventory flow](../../../docs/paymentflow.md)
- [Queue / sweeps](../../infrastructure/queue/README.md)
- [Prisma schema](../../../prisma/README.md)
