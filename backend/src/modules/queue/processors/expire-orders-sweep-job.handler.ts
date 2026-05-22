/** ----- Handle expire orders sweep job.handler ----- **/
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';

import { AppConfigService } from '../../../config';
import { QueueRepository } from '../queue.repository';
import { ExpireOrdersSweepJobCommand } from '../application/commands/queue-jobs.command';

/** ----- Handle expir rder wee o andler class ----- **/
@CommandHandler(ExpireOrdersSweepJobCommand)
export class ExpireOrdersSweepJobHandler implements ICommandHandler<ExpireOrdersSweepJobCommand> {
  private readonly log = new Logger(ExpireOrdersSweepJobHandler.name);

  constructor(
    private readonly repository: QueueRepository,
    private readonly cfg: AppConfigService,
  ) {}

  /** ----- Handle execute method ----- **/
  async execute(command: ExpireOrdersSweepJobCommand): Promise<void> {
    void command;
    const cutoff = new Date(
      Date.now() - this.cfg.order.processingExpireMs,
    );

    const result = await this.repository.expireProcessingOrders(cutoff);

    if (result.count > 0) {
      this.log.log(`Expired ${result.count} processing order(s)`);
    }
  }
}
