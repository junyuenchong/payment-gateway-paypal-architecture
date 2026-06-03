import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ExpireUnpaidOrdersCommand } from '../../../../modules/inventory/cqrs/commands/expire-unpaid-orders.command';
import { ExpireUnpaidOrdersSweepJobCommand } from '../commands/queue-jobs.command';

/** ----- Queue job: delegate to inventory ExpireUnpaidOrdersCommand. ----- **/
@CommandHandler(ExpireUnpaidOrdersSweepJobCommand)
export class ExpireUnpaidOrdersSweepJobHandler implements ICommandHandler<ExpireUnpaidOrdersSweepJobCommand> {
  constructor(private readonly commandBus: CommandBus) {}

  async execute(command: ExpireUnpaidOrdersSweepJobCommand): Promise<void> {
    void command;
    await this.commandBus.execute(new ExpireUnpaidOrdersCommand());
  }
}
