/**
 * ------------------------------------------------------
 * Payment Dead Letter Queue Definitions
 * ------------------------------------------------------
 */
export const PAYMENT_DLQ_QUEUE = 'payment-dlq-queue';
export const PAYMENT_DLQ_JOB = 'payment-failed-job';

export type PaymentDlqJobData = {
  sourceQueue: string;
  sourceJobName: string;
  sourceJobId: string | null;
  attemptsMade: number;
  configuredAttempts: number;
  reason: string;
  payload: unknown;
  failedAt: string;
};
