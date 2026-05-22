/** ----- Define queue job payload types. ----- **/
export interface CreatePaymentIntentJob {
  orderId: string;
}

/** ----- Define payload for capture payment job. ----- **/
export interface CapturePaymentJob {
  orderId: string;
}

/** ----- Define payload for process webhook job. ----- **/
export interface ProcessWebhookJob {
  webhookEventId: string;
}

/** ----- Define empty payload for expiry sweep job. ----- **/
export type ExpireOrdersSweepJob = Record<string, never>;

/** ----- Used by mock worker to simulate capture success. ----- **/
export interface MockCaptureSuccessJob {
  internalOrderId: string;
  paypalOrderId: string;
}

/** ----- Define empty payload for reconciliation sweep job. ----- **/
export type ReconcileOrdersSweepJob = Record<string, never>;

/** ----- Expire ACTIVE stock reservations past TTL. ----- **/
export type ExpireReservationsSweepJob = Record<string, never>;

/** ----- Expire stale UNPAID orders without active reservation. ----- **/
export type ExpireUnpaidOrdersSweepJob = Record<string, never>;
