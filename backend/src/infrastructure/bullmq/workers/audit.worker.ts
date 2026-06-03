import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { Job } from 'bullmq';

import { AUDIT_QUEUE } from '../bullmq.constants';
import { JOBS } from '../../queue/enums/queue-job.enum';
import { executeQueueJob } from './worker.helper';

/** ----- Process webhook audit jobs. ----- **/
@Injectable()
@Processor(AUDIT_QUEUE)
export class AuditWorker extends WorkerHost {
  private readonly log = new Logger(AuditWorker.name);

  constructor(private readonly commandBus: CommandBus) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== JOBS.PROCESS_WEBHOOK) {
      throw new Error(`Job ${job.name} is not allowed on ${AUDIT_QUEUE}`);
    }
    await executeQueueJob(this.commandBus, job, this.log);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    this.log.error(`Job failed: ${job.name} (${job.id ?? 'no-id'})`);
    this.log.error(err?.stack ?? err?.message ?? String(err));
  }
}
