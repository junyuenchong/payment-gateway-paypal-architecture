/**
 * ------------------------------------------------------
 * Create Payment Intent Queue Definitions
 * ------------------------------------------------------
 */
export const CREATE_PAYMENT_INTENT_QUEUE = 'create-payment-intent-queue';
export const CREATE_PAYMENT_INTENT_JOB = 'create-payment-intent';

export type CreatePaymentIntentJobData = {
  orderId: string;
};
