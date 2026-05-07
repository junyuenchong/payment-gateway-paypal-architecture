/**
 * ------------------------------------------------------
 * Payment Intent Response Type
 * ------------------------------------------------------
 */
export type PaymentIntentResponse = {
  orderId: string;
  provider: 'PAYPAL' | 'MOCK';
  approvalUrl: string | null;
  status: string;
};

/**
 * ------------------------------------------------------
 * Capture Payment Response Type
 * ------------------------------------------------------
 */
export type CapturePaymentResponse = {
  orderId: string;
  status: 'PAID' | 'FAILED' | 'PROCESSING';
  paypalOrderId: string;
  message: string;
};

/**
 * ------------------------------------------------------
 * Order Status Response Type
 * ------------------------------------------------------
 */
export type OrderStatusResponse = {
  id: string;
  status: string;
  paypalOrderId?: string | null;
  approvalUrl?: string | null;
};

/**
 * ------------------------------------------------------
 * Order List Item Response Type
 * ------------------------------------------------------
 */
export type OrderListItemResponse = {
  id: string;
  amount: string;
  currency: string;
  status: string;
  paypalOrderId?: string | null;
  updatedAt: string;
};

/**
 * ------------------------------------------------------
 * Order List Response Type
 * ------------------------------------------------------
 */
export type OrderListResponse = {
  data: OrderListItemResponse[];
  pageInfo: {
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
    direction: 'asc' | 'desc';
  };
};
