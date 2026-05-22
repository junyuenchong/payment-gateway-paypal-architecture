/** ----- Stock reservation lifecycle statuses. ----- **/
export const StockReservationStatus = {
  ACTIVE: 'ACTIVE',
  COMMITTED: 'COMMITTED',
  RELEASED: 'RELEASED',
} as const;

export type StockReservationStatusCode =
  (typeof StockReservationStatus)[keyof typeof StockReservationStatus];

/** ----- Append-only ledger reasons (audit trail). ----- **/
export const StockMovementReason = {
  RESERVE: 'RESERVE',
  EXTEND: 'EXTEND',
  COMMIT: 'COMMIT',
  RELEASE: 'RELEASE',
  EXPIRE: 'EXPIRE',
  RESTORE_REFUND: 'RESTORE_REFUND',
} as const;

export type StockMovementReasonCode =
  (typeof StockMovementReason)[keyof typeof StockMovementReason];

/** ----- Build deterministic reservation idempotency key per order line. ----- **/
export function buildReservationKey(orderId: string, sku: string): string {
  return `reserve:${orderId}:${sku}`;
}

/** ----- Sort SKUs to avoid multi-SKU deadlock (Amazon-style lock ordering). ----- **/
export function sortSkusForLock(skus: string[]): string[] {
  return [...skus].sort((a, b) => a.localeCompare(b));
}
