/** ----- Order row locked for payment-intent flow. ----- **/
export type OrderPaymentIntentLockRow = {
  id: string;
  status: string;
  currency: string;
  paypalOrderId: string | null;
  approvalUrl: string | null;
};

/** ----- Order row locked for payment-intent worker. ----- **/
export type OrderPaymentIntentWorkerLockRow = OrderPaymentIntentLockRow & {
  amount: string;
};

/** ----- Order row locked for capture. ----- **/
export type OrderCaptureLockRow = {
  id: string;
  status: string;
  paypalOrderId: string | null;
};

/** ----- Order id + status after FOR UPDATE. ----- **/
export type OrderStatusLockRow = {
  id: string;
  status: string;
};

/** ----- Order gateway fields for mock / approval updates. ----- **/
export type OrderGatewayFieldsLockRow = {
  id: string;
  approvalUrl: string | null;
  paypalOrderId: string | null;
};

/** ----- Order approval URL guard row. ----- **/
export type OrderApprovalUrlLockRow = {
  id: string;
  approvalUrl: string | null;
};

/** ----- Product row locked by SKU. ----- **/
export type ProductSkuLockRow = {
  id: string;
  sku: string;
  stock: number;
  reservedStock: number;
};

/** ----- Webhook event status row. ----- **/
export type WebhookEventStatusLockRow = {
  id: string;
  status: string;
};
