import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AppConfigService } from '../../config';
import { toError } from '../../shared/helpers/error.util';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class ReconciliationSchedulerService implements OnModuleInit {
  private readonly log = new Logger(ReconciliationSchedulerService.name);

  constructor(
    private readonly cfg: AppConfigService,
    private readonly queue: QueueService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue
      .upsertReconcileOrdersSweep(this.cfg.reconciliation.everyMs)
      .catch((err: unknown) => {
        const normalized = toError(err, 'Upsert reconciliation sweep failed');
        this.log.error('Failed to upsert reconciliation sweep job');
        this.log.error(normalized.stack ?? normalized.message);
      });
  }
}
