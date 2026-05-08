import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { CommandBus } from '@nestjs/cqrs';

import { JOBS, QUEUE_NAME, type JobName } from './queue.constant';
import { toError } from '../common/error.util';
import {
  CapturePaymentJobCommand,
  CreatePaymentIntentJobCommand,
  ExpireOrdersSweepJobCommand,
  MockCaptureSuccessJobCommand,
  ProcessWebhookJobCommand,
  ReconcileOrdersSweepJobCommand,
} from './application/commands/queue-jobs.command';
import type {
  CapturePaymentJob,
  CreatePaymentIntentJob,
  ExpireOrdersSweepJob,
  MockCaptureSuccessJob,
  ProcessWebhookJob,
  ReconcileOrdersSweepJob,
} from './queue.interface';

type AnyJobData =
  | CreatePaymentIntentJob
  | CapturePaymentJob
  | ProcessWebhookJob
  | ExpireOrdersSweepJob
  | ReconcileOrdersSweepJob
  | MockCaptureSuccessJob;

/** ----- Process queue jobs. ----- **/
@Injectable()
@Processor(QUEUE_NAME)
export class QueueProcessor extends WorkerHost {
  private readonly log = new Logger(QueueProcessor.name);

  constructor(private readonly commandBus: CommandBus) {
    super();
  }

  async process(job: Job<AnyJobData>): Promise<void> {
    // Route by job name.
    try {
      switch (job.name as JobName) {
        case JOBS.CREATE_PAYMENT_INTENT:
          await this.commandBus.execute(
            new CreatePaymentIntentJobCommand(
              job.data as CreatePaymentIntentJob,
            ),
          );
          return;
        case JOBS.CAPTURE_PAYMENT:
          await this.commandBus.execute(
            new CapturePaymentJobCommand(job.data as CapturePaymentJob),
          );
          return;
        case JOBS.PROCESS_WEBHOOK:
          await this.commandBus.execute(
            new ProcessWebhookJobCommand(job.data as ProcessWebhookJob),
          );
          return;
        case JOBS.EXPIRE_ORDERS_SWEEP:
          await this.commandBus.execute(
            new ExpireOrdersSweepJobCommand(job.data as ExpireOrdersSweepJob),
          );
          return;
        case JOBS.RECONCILE_ORDERS_SWEEP:
          await this.commandBus.execute(
            new ReconcileOrdersSweepJobCommand(
              job.data as ReconcileOrdersSweepJob,
            ),
          );
          return;
        case JOBS.MOCK_CAPTURE_SUCCESS:
          await this.commandBus.execute(
            new MockCaptureSuccessJobCommand(job.data as MockCaptureSuccessJob),
          );
          return;
        default:
          throw new Error(`Unknown job name: ${job.name ?? 'undefined'}`);
      }
    } catch (error: unknown) {
      const normalized = toError(error, 'Queue processor execution failed');
      this.log.error(
        `Queue job failed in processor: ${job.name ?? 'undefined'}`,
      );
      this.log.error(normalized.stack ?? normalized.message);
      throw normalized;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    // Log only; retry policy is configured in queue options.
    this.log.error(`Job failed: ${job.name} (${job.id ?? 'no-id'})`);
    this.log.error(err?.stack ?? err?.message ?? String(err));
  }
}
