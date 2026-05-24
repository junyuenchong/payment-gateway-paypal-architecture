/** ----- Stock reservation lifecycle (persisted as text; never DELETE rows). ----- **/
export const StockReservationStatus = {
  /** Checkout hold — payment not completed yet */
  RESERVED: 'RESERVED',
  /** Payment success — reserved → sold; total_stock & reserved_stock updated */
  CONFIRMED: 'CONFIRMED',
  /** Optional fulfilment step after CONFIRMED (shipping / WMS) */
  FULFILLED: 'FULFILLED',
  /** Payment failed / cancelled — hold released */
  RELEASED: 'RELEASED',
  /** Checkout or reservation TTL elapsed */
  EXPIRED: 'EXPIRED',
  /** Refund after CONFIRMED — on-hand restocked; row kept for traceability */
  RESTOCKED: 'RESTOCKED',
} as const;

export type StockReservationStatusCode =
  (typeof StockReservationStatus)[keyof typeof StockReservationStatus];

/** Terminal statuses: row retained for audit / analytics (archive via cron later). */
export const TERMINAL_STOCK_RESERVATION_STATUSES: StockReservationStatusCode[] =
  [
    StockReservationStatus.CONFIRMED,
    StockReservationStatus.FULFILLED,
    StockReservationStatus.RELEASED,
    StockReservationStatus.EXPIRED,
    StockReservationStatus.RESTOCKED,
  ];
