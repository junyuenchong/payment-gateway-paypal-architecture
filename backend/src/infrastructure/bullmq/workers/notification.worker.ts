import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { Job } from 'bullmq';

import { NOTIFICATION_QUEUE } from '../bullmq.constants';
import { JOBS } from '../../queue/enums/queue-job.enum';
import { executeQueueJob } from './worker.helper';

const NOTIFICATION_JOBS = new Set<string>([
  JOBS.EXPIRE_ORDERS_SWEEP,
  JOBS.EXPIRE_RESERVATIONS_SWEEP,
  JOBS.EXPIRE_UNPAID_ORDERS_SWEEP,
  JOBS.RECONCILE_ORDERS_SWEEP,
]);

/** ----- Process scheduled sweep / reconciliation jobs. ----- **/
@Injectable()
@Processor(NOTIFICATION_QUEUE)
export class NotificationWorker extends WorkerHost {
  private readonly log = new Logger(NotificationWorker.name);

  constructor(private readonly commandBus: CommandBus) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (!NOTIFICATION_JOBS.has(job.name)) {
      throw new Error(`Job ${job.name} is not allowed on ${NOTIFICATION_QUEUE}`);
    }
    await executeQueueJob(this.commandBus, job, this.log);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    this.log.error(`Job failed: ${job.name} (${job.id ?? 'no-id'})`);
    this.log.error(err?.stack ?? err?.message ?? String(err));
  }
}
