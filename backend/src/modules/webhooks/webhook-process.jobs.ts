/**
 * ------------------------------------------------------
 * Webhook Process Queue Definitions
 * ------------------------------------------------------
 */
export const WEBHOOK_PROCESS_QUEUE = 'payment-webhook-process-queue';
export const WEBHOOK_PROCESS_JOB = 'process-webhook-event';

export type WebhookProcessJobData = {
  webhookEventId: string;
};
