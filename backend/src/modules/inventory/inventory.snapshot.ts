/**
 * ERP stock snapshot math (must match InventoryRepository SQL).
 * available_stock = total_stock - reserved_stock
 */
export type ErpStockSnapshot = {
  totalStock: number;
  reservedStock: number;
};

export function availableStock(snapshot: ErpStockSnapshot): number {
  return snapshot.totalStock - snapshot.reservedStock;
}

/** Step 1 — Create order: reserve qty (physical unchanged). */
export function applyReserve(
  snapshot: ErpStockSnapshot,
  qty: number,
): ErpStockSnapshot {
  return {
    totalStock: snapshot.totalStock,
    reservedStock: snapshot.reservedStock + qty,
  };
}

/** Step 2 — Payment pending: no product row change. */
export function applyPaymentPending(snapshot: ErpStockSnapshot): ErpStockSnapshot {
  return { ...snapshot };
}

/** Step 3 — Payment success: sold qty leaves warehouse + reserved pool. */
export function applyPaymentSuccess(
  snapshot: ErpStockSnapshot,
  qty: number,
): ErpStockSnapshot {
  return {
    totalStock: snapshot.totalStock - qty,
    reservedStock: snapshot.reservedStock - qty,
  };
}

/** Step 4 — Fail / expire / cancel: release hold only. */
export function applyReleaseReservation(
  snapshot: ErpStockSnapshot,
  qty: number,
): ErpStockSnapshot {
  return {
    totalStock: snapshot.totalStock,
    reservedStock: snapshot.reservedStock - qty,
  };
}

export function toAvailabilityView(snapshot: ErpStockSnapshot) {
  return {
    totalStock: snapshot.totalStock,
    reserved: snapshot.reservedStock,
    available: availableStock(snapshot),
  };
}
