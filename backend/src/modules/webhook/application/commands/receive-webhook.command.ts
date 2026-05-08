import type { WebhookAuthHeaders } from '../../webhook.interface';

/** ----- Define receive webhook result ----- **/
export type ReceiveWebhookCommandResult = {
  duplicate: boolean;
};

/** ----- Handle receive webhook command ----- **/
export class ReceiveWebhookCommand {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(
    public readonly params: {
      rawBody: Buffer | undefined;
      headers: WebhookAuthHeaders;
    },
  ) {}
}
