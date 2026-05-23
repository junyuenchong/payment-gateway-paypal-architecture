/** ----- Stock reservation lifecycle (DB stores as text). ----- **/
export const StockReservationStatus = {
  ACTIVE: 'ACTIVE',
  COMMITTED: 'COMMITTED',
  RELEASED: 'RELEASED',
} as const;

export type StockReservationStatusCode =
  (typeof StockReservationStatus)[keyof typeof StockReservationStatus];
