/** ----- Handle record webhook and mark processed.handler ----- **/
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { IdempotencyRepository } from '../../idempotency.repository';
import { RecordWebhookAndMarkProcessedCommand } from '../commands/idempotency.command';

/** ----- Handle recor ebhoo n ar rocesse andler class ----- **/
@CommandHandler(RecordWebhookAndMarkProcessedCommand)
export class RecordWebhookAndMarkProcessedHandler implements ICommandHandler<RecordWebhookAndMarkProcessedCommand> {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly repository: IdempotencyRepository) {}

  /** ----- Handle execute method ----- **/
  execute(command: RecordWebhookAndMarkProcessedCommand) {
    return this.repository.recordWebhookAndMarkProcessed(command.params);
  }
}
