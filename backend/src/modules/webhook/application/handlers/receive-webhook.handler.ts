import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { WebhookService } from '../../webhook.service';
import {
  ReceiveWebhookCommand,
  type ReceiveWebhookCommandResult,
} from '../commands/receive-webhook.command';

/** ----- Handle receive webhook handler ----- **/
@CommandHandler(ReceiveWebhookCommand)
export class ReceiveWebhookHandler implements ICommandHandler<ReceiveWebhookCommand> {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly webhookService: WebhookService) {}

  /** ----- Handle execute method ----- **/
  execute(
    command: ReceiveWebhookCommand,
  ): Promise<ReceiveWebhookCommandResult> {
    return this.webhookService.receivePayPalWebhook(command.params);
  }
}
