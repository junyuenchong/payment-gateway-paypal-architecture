import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import {
  EXPIRE_ORDERS_SWEEP_JOB,
  ORDER_MAINTENANCE_QUEUE,
  type ExpireOrdersSweepJobData,
} from './order-expiry.jobs';

@Injectable()
export class OrderExpirySchedulerService implements OnModuleInit {
  private readonly log = new Logger(OrderExpirySchedulerService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectQueue(ORDER_MAINTENANCE_QUEUE)
    private readonly queue: Queue<ExpireOrdersSweepJobData>,
  ) {}

  async onModuleInit(): Promise<void> {
    const every = Number(
      this.config.get('ORDER_EXPIRE_SWEEP_EVERY_MS') ?? 60000,
    );
    const normalizedEvery = Number.isFinite(every) && every > 0 ? every : 60000;

    await this.queue
      .add(
        EXPIRE_ORDERS_SWEEP_JOB,
        {},
        {
          jobId: EXPIRE_ORDERS_SWEEP_JOB,
          repeat: { every: normalizedEvery },
          attempts: 3,
          backoff: { type: 'fixed', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: 50,
        },
      )
      .then(() => undefined)
      .catch((err: unknown) => {
        this.log.error('Failed to upsert expire orders sweep job');
        this.log.error(err instanceof Error ? err.stack : String(err));
      });
  }
}
