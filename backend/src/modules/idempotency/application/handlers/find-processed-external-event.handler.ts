/** ----- Handle find processed external event.handler ----- **/
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { IdempotencyRepository } from '../../idempotency.repository';
import { FindProcessedExternalEventCommand } from '../commands/idempotency.command';

/** ----- Handle fin rocesse xterna ven andler class ----- **/
@CommandHandler(FindProcessedExternalEventCommand)
export class FindProcessedExternalEventHandler implements ICommandHandler<FindProcessedExternalEventCommand> {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly repository: IdempotencyRepository) {}

  /** ----- Handle execute method ----- **/
  execute(command: FindProcessedExternalEventCommand) {
    return this.repository.findProcessedExternalEvent(command.eventId);
  }
}
