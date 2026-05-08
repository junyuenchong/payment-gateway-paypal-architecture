/** ----- Handle expire orders sweep job.handler ----- **/
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

import { QueueRepository } from '../../queue.repository';
import { ExpireOrdersSweepJobCommand } from '../commands/queue-jobs.command';

/** ----- Handle expir rder wee o andler class ----- **/
@CommandHandler(ExpireOrdersSweepJobCommand)
export class ExpireOrdersSweepJobHandler implements ICommandHandler<ExpireOrdersSweepJobCommand> {
  private readonly log = new Logger(ExpireOrdersSweepJobHandler.name);

  constructor(
    private readonly repository: QueueRepository,
    private readonly config: ConfigService,
  ) {}

  /** ----- Handle execute method ----- **/
  async execute(command: ExpireOrdersSweepJobCommand): Promise<void> {
    void command;
    const ttlMs = Number(
      this.config.get('ORDER_PROCESSING_EXPIRE_MS') ?? 900000,
    );
    const normalizedTtlMs =
      Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : 900000;
    const cutoff = new Date(Date.now() - normalizedTtlMs);

    const result = await this.repository.expireProcessingOrders(cutoff);

    if (result.count > 0) {
      this.log.log(`Expired ${result.count} processing order(s)`);
    }
  }
}
