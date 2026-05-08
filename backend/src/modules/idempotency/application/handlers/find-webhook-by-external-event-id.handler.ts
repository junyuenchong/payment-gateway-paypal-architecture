/** ----- Handle find webhook by external event id.handler ----- **/
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { IdempotencyRepository } from '../../idempotency.repository';
import { FindWebhookByExternalEventIdCommand } from '../commands/idempotency.command';

/** ----- Handle fin ebhoo  xterna ven  andler class ----- **/
@CommandHandler(FindWebhookByExternalEventIdCommand)
export class FindWebhookByExternalEventIdHandler implements ICommandHandler<FindWebhookByExternalEventIdCommand> {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly repository: IdempotencyRepository) {}

  /** ----- Handle execute method ----- **/
  execute(command: FindWebhookByExternalEventIdCommand) {
    return this.repository.findWebhookByExternalEventId(command.eventId);
  }
}
