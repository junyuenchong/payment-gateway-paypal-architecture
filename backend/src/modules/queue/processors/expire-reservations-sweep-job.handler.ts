import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ExpireStaleReservationsCommand } from '../../inventory/application/commands/expire-stale-reservations.command';
import { ExpireReservationsSweepJobCommand } from '../application/commands/queue-jobs.command';

/** ----- Queue job: delegate to inventory ExpireStaleReservationsCommand. ----- **/
@CommandHandler(ExpireReservationsSweepJobCommand)
export class ExpireReservationsSweepJobHandler implements ICommandHandler<ExpireReservationsSweepJobCommand> {
  constructor(private readonly commandBus: CommandBus) {}

  async execute(command: ExpireReservationsSweepJobCommand): Promise<void> {
    void command;
    await this.commandBus.execute(new ExpireStaleReservationsCommand());
  }
}
