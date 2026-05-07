/**
 * ------------------------------------------------------
 * Capture Payment Queue Definitions
 * ------------------------------------------------------
 */
export const CAPTURE_PAYMENT_QUEUE = 'capture-payment-queue';
export const CAPTURE_PAYMENT_JOB = 'capture-payment';

export type CapturePaymentJobData = {
  orderId: string;
};
