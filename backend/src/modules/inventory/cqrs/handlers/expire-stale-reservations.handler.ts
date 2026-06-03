import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';

import { InventoryService } from '../../inventory.service';
import { ExpireStaleReservationsCommand } from '../commands/expire-stale-reservations.command';

/** ----- Handle expire stale reservations command. ----- **/
@CommandHandler(ExpireStaleReservationsCommand)
export class ExpireStaleReservationsHandler implements ICommandHandler<ExpireStaleReservationsCommand> {
  private readonly log = new Logger(ExpireStaleReservationsHandler.name);

  constructor(private readonly inventory: InventoryService) {}

  async execute(command: ExpireStaleReservationsCommand): Promise<{ count: number }> {
    const result = await this.inventory.expireStaleReservations(command.cutoff);
    if (result.count > 0) {
      this.log.log(`Expired ${result.count} reservation batch(es)`);
    }
    return result;
  }
}
