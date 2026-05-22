import configuration from '../../config/configuration';

/** ----- Define queue name from centralized config. ----- **/
export const QUEUE_NAME = configuration().bullmq.queueName;

export const JOBS = {
  CREATE_PAYMENT_INTENT: 'create-payment-intent',
  CAPTURE_PAYMENT: 'capture-payment',
  PROCESS_WEBHOOK: 'process-webhook-event',
  EXPIRE_ORDERS_SWEEP: 'expire-orders-sweep',
  EXPIRE_RESERVATIONS_SWEEP: 'expire-reservations-sweep',
  EXPIRE_UNPAID_ORDERS_SWEEP: 'expire-unpaid-orders-sweep',
  RECONCILE_ORDERS_SWEEP: 'reconcile-orders-sweep',
  MOCK_CAPTURE_SUCCESS: 'mock-capture-success',
} as const;

export type JobName = (typeof JOBS)[keyof typeof JOBS];
