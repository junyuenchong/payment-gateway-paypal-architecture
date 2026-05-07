/**
 * ------------------------------------------------------
 * Webhook Event Status Constants
 * ------------------------------------------------------
 */
export const WebhookEventStatus = {
  RECEIVED: 'RECEIVED',
  FAILED: 'FAILED',
  PROCESSED: 'PROCESSED',
} as const;

export type WebhookEventStatusCode =
  (typeof WebhookEventStatus)[keyof typeof WebhookEventStatus];
