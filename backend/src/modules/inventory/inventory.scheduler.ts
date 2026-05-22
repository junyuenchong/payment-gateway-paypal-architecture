import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { AppConfigService } from '../../config';
import { toError } from '../common/error.util';
import { QueueService } from '../queue/queue.service';

/** ----- Schedule inventory TTL sweeps on startup. ----- **/
@Injectable()
export class InventorySchedulerService implements OnModuleInit {
  private readonly log = new Logger(InventorySchedulerService.name);

  constructor(
    private readonly cfg: AppConfigService,
    private readonly queue: QueueService,
  ) {}

  async onModuleInit(): Promise<void> {
    await Promise.all([
      this.queue.upsertExpireReservationsSweep(
        this.cfg.inventory.reservationSweepEveryMs,
      ),
      this.queue.upsertExpireUnpaidOrdersSweep(
        this.cfg.inventory.unpaidOrderSweepEveryMs,
      ),
    ]).catch((err: unknown) => {
      const normalized = toError(err, 'Upsert inventory sweeps failed');
      this.log.error('Failed to upsert inventory sweep jobs');
      this.log.error(normalized.stack ?? normalized.message);
    });
  }
}
