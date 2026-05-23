/** ----- Webhook intake / processing statuses (DB stores as text). ----- **/
export const WebhookEventStatus = {
  RECEIVED: 'RECEIVED',
  PROCESSED: 'PROCESSED',
  FAILED: 'FAILED',
} as const;

export type WebhookEventStatusCode =
  (typeof WebhookEventStatus)[keyof typeof WebhookEventStatus];
