/** ----- Handle process webhook job.handler ----- **/
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { WebhookService } from '../../../webhook/webhook.service';
import { ProcessWebhookJobCommand } from '../commands/queue-jobs.command';

/** ----- Handle proces ebhoo o andler class ----- **/
@CommandHandler(ProcessWebhookJobCommand)
export class ProcessWebhookJobHandler implements ICommandHandler<ProcessWebhookJobCommand> {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly webhook: WebhookService) {}

  /** ----- Handle execute method ----- **/
  async execute(command: ProcessWebhookJobCommand): Promise<void> {
    await this.webhook.processWebhookEvent(command.data.webhookEventId);
  }
}
