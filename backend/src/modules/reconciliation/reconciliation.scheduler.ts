import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { toError } from '../common/error.util';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class ReconciliationSchedulerService implements OnModuleInit {
  private readonly log = new Logger(ReconciliationSchedulerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly queue: QueueService,
  ) {}

  async onModuleInit(): Promise<void> {
    const every = Number(this.config.get('RECONCILIATION_EVERY_MS') ?? 120000);
    const normalizedEvery =
      Number.isFinite(every) && every > 0 ? every : 120000;

    await this.queue
      .upsertReconcileOrdersSweep(normalizedEvery)
      .catch((err: unknown) => {
        const normalized = toError(err, 'Upsert reconciliation sweep failed');
        this.log.error('Failed to upsert reconciliation sweep job');
        this.log.error(normalized.stack ?? normalized.message);
      });
  }
}
