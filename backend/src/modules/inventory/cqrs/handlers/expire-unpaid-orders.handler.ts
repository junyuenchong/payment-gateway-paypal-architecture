import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';

import { AppConfigService } from '../../../../common/config';
import { InventoryService } from '../../inventory.service';
import { ExpireUnpaidOrdersCommand } from '../commands/expire-unpaid-orders.command';

/** ----- Handle expire unpaid orders command. ----- **/
@CommandHandler(ExpireUnpaidOrdersCommand)
export class ExpireUnpaidOrdersHandler implements ICommandHandler<ExpireUnpaidOrdersCommand> {
  private readonly log = new Logger(ExpireUnpaidOrdersHandler.name);

  constructor(
    private readonly inventory: InventoryService,
    private readonly cfg: AppConfigService,
  ) {}

  async execute(command: ExpireUnpaidOrdersCommand): Promise<{ count: number }> {
    void command;
    const cutoff = new Date(
      Date.now() - this.cfg.inventory.unpaidOrderExpireMs,
    );
    const result =
      await this.inventory.expireUnpaidOrdersWithoutActiveReservation(cutoff);
    if (result.count > 0) {
      this.log.log(`Expired ${result.count} unpaid order(s)`);
    }
    return result;
  }
}
