# Inventory module

Amazon-style stock reservation: checkout hold, payment extension, commit, release, refund restore.

**Layering:** `Controller` → `Query` / `Command` → `Handler` → `Service` → `Repository`

Cross-module callers (`OrderRepository`, `WebhookRepository`, `QueueRepository`, …) use **`InventoryService`** inside shared DB transactions.

**DB:** `InventoryRepository` injects `PrismaService` from `../../database/prisma/prisma.service`.

---

## Structure

```text
inventory/
├── application/
│   ├── commands/          # CQRS commands (sweeps)
│   ├── handlers/          # Command + query handlers
│   └── queries/           # Read models
├── cqrs/index.ts          # Handler registration
├── dto/                   # Response types
├── inventory.controller.ts
├── inventory.service.ts   # Domain + Redis SKU locks
├── inventory.repository.ts
├── inventory.scheduler.ts # Schedules sweep jobs via QueueService
└── inventory.constant.ts
```

---

## CQRS surface

| Type | Name | Used by |
| ---- | ---- | ------- |
| Query | `ListProductsQuery` | `GET /inventory/products` |
| Command | `ExpireStaleReservationsCommand` | Queue `expire-reservations-sweep` |
| Command | `ExpireUnpaidOrdersCommand` | Queue `expire-unpaid-orders-sweep` |

Transactional methods (`reserveAtCheckout`, `commitForOrder`, `releaseForOrder`, `restoreForRefund`, …) live on **`InventoryService`** only.

---

## Related docs

- [Payment & inventory flow](../../../docs/paymentflow.md)
- [Queue module](../queue/README.md) — sweep job handlers
- [Prisma schema](../../../prisma/README.md)
- [Project README](../../../README.md)
