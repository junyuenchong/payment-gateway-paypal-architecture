/** ----- Stock ledger types (inventory_transactions.reason; append-only). ----- **/
export const StockMovementReason = {
  RESERVE: 'RESERVE',
  EXTEND: 'EXTEND',
  CONFIRM: 'CONFIRM',
  RELEASE: 'RELEASE',
  EXPIRE: 'EXPIRE',
  RESTOCK: 'RESTOCK',
} as const;

export type StockMovementReasonCode =
  (typeof StockMovementReason)[keyof typeof StockMovementReason];
