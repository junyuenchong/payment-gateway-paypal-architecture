import type { OrderStatusCode } from '../../../modules/order/enums/order-status.enum';

/** ----- Normalized PayPal checkout order status. ----- **/
export type PayPalOrderStatus =
  | 'CREATED'
  | 'SAVED'
  | 'APPROVED'
  | 'VOIDED'
  | 'COMPLETED'
  | 'PAYER_ACTION_REQUIRED'
  | 'UNKNOWN';

/** ----- Internal module health response. ----- **/
export type ReconciliationStatusDto = {
  ok: true;
  module: 'reconciliation';
};

/** ----- Query stale PROCESSING orders for sweep. ----- **/
export type FindProcessingCandidatesParams = {
  cutoff: Date;
  take: number;
};

/** ----- Candidate row selected for gateway reconciliation. ----- **/
export type ProcessingOrderCandidateDto = {
  id: string;
  paypalOrderId: string | null;
};

/** ----- Apply gateway-derived status to a locked order. ----- **/
export type UpdateProcessingOrderIfNeededParams = {
  orderId: string;
  next: OrderStatusCode;
};
