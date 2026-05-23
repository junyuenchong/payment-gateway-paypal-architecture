/** ----- Stock ledger movement reasons (DB stores as text). ----- **/
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
