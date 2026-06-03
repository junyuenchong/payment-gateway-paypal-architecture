import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { Job } from 'bullmq';

import { EMAIL_QUEUE } from '../bullmq.constants';
import { JOBS } from '../../queue/enums/queue-job.enum';
import { executeQueueJob } from './worker.helper';

const EMAIL_JOBS = new Set<string>([
  JOBS.CREATE_PAYMENT_INTENT,
  JOBS.CAPTURE_PAYMENT,
  JOBS.MOCK_CAPTURE_SUCCESS,
]);

/** ----- Process payment jobs on the email queue. ----- **/
@Injectable()
@Processor(EMAIL_QUEUE)
export class EmailWorker extends WorkerHost {
  private readonly log = new Logger(EmailWorker.name);

  constructor(private readonly commandBus: CommandBus) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (!EMAIL_JOBS.has(job.name)) {
      throw new Error(`Job ${job.name} is not allowed on ${EMAIL_QUEUE}`);
    }
    await executeQueueJob(this.commandBus, job, this.log);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    this.log.error(`Job failed: ${job.name} (${job.id ?? 'no-id'})`);
    this.log.error(err?.stack ?? err?.message ?? String(err));
  }
}
