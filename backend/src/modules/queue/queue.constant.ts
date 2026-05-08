/** ----- Define queue name from environment. ----- **/
export const QUEUE_NAME = process.env.BULLMQ_QUEUE_NAME || 'app-queue';

export const JOBS = {
  CREATE_PAYMENT_INTENT: 'create-payment-intent',
  CAPTURE_PAYMENT: 'capture-payment',
  PROCESS_WEBHOOK: 'process-webhook-event',
  EXPIRE_ORDERS_SWEEP: 'expire-orders-sweep',
  RECONCILE_ORDERS_SWEEP: 'reconcile-orders-sweep',
  MOCK_CAPTURE_SUCCESS: 'mock-capture-success',
} as const;

export type JobName = (typeof JOBS)[keyof typeof JOBS];
