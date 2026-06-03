# Reconciliation

Sometimes an order sits in `PROCESSING` while PayPal already finished (or failed). This module **periodically compares** our DB with the gateway and fixes mismatches.

Triggered by the `reconcile-orders-sweep` job in the notification queue.

**Flow:** Queue worker, then Command, then Handler, then `ReconciliationService`

```text
reconciliation/
├── dto/reconciliation.dto.ts
├── helpers/reconciliation.helper.ts
├── cqrs/commands/ + handlers/
├── reconciliation.controller.ts
├── reconciliation.service.ts
└── reconciliation.module.ts
```

---

## Main types

| Type | Used for |
| ---- | -------- |
| `PayPalOrderStatus` | Normalized checkout status from PayPal |
| `ReconciliationStatusDto` | `GET /internal/reconciliation/status` |
| `FindProcessingCandidatesParams` | Which orders to check in a sweep |
| `UpdateProcessingOrderIfNeededParams` | Apply a fix inside a transaction |

---

## Config

Tune via `AppConfigService.reconciliation`: `everyMs`, `batchSize`, `lookbackMs` (see `backend/.env.example`).

**Related:** job handler in [queue](../queue/README.md); sweep interval in [config](../../common/config/README.md).
