/** ----- Stock ledger types (inventory_transactions.reason; append-only). ----- **/
export const StockMovementReason = {
  RESERVE: 'RESERVE',
  EXTEND: 'EXTEND',
  /** Payment success — prefer CONFIRM; COMMIT kept for legacy rows */
  CONFIRM: 'CONFIRM',
  COMMIT: 'COMMIT',
  RELEASE: 'RELEASE',
  EXPIRE: 'EXPIRE',
  /** Refund restock — prefer RESTOCK; RESTORE_REFUND kept for legacy rows */
  RESTOCK: 'RESTOCK',
  RESTORE_REFUND: 'RESTORE_REFUND',
} as const;

export type StockMovementReasonCode =
  (typeof StockMovementReason)[keyof typeof StockMovementReason];
