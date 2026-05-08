/** ----- Define order status constants. ----- **/
export const OrderStatus = {
  UNPAID: 'UNPAID',
  PROCESSING: 'PROCESSING',
  EXPIRED: 'EXPIRED',
  PAID: 'PAID',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REFUNDING: 'REFUNDING',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  REFUNDED: 'REFUNDED',
} as const;

export type OrderStatusCode = (typeof OrderStatus)[keyof typeof OrderStatus];
