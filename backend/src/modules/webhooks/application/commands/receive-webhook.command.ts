export class ReceiveWebhookCommand {
  /**
   * ------------------------------------------------------
   * Receive Webhook Command Payload
   * ------------------------------------------------------
   */
  constructor(public readonly rawBody: Buffer) {}
}

export type ReceiveWebhookResult = { duplicate: boolean };

export function isReceiveWebhookResult(
  value: unknown,
): value is ReceiveWebhookResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const rec = value as { duplicate?: unknown };
  return typeof rec.duplicate === 'boolean';
}
