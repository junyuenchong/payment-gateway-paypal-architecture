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

type CommandFactory = (data: AnyJobData) => object;

const COMMAND_BY_JOB: Record<JobName, CommandFactory> = {
  [JOBS.CREATE_PAYMENT_INTENT]: (data) =>
    new CreatePaymentIntentJobCommand(data as CreatePaymentIntentJob),
  [JOBS.CAPTURE_PAYMENT]: (data) =>
    new CapturePaymentJobCommand(data as CapturePaymentJob),
  [JOBS.PROCESS_WEBHOOK]: (data) =>
    new ProcessWebhookJobCommand(data as ProcessWebhookJob),
  [JOBS.EXPIRE_ORDERS_SWEEP]: (data) =>
    new ExpireOrdersSweepJobCommand(data as ExpireOrdersSweepJob),
  [JOBS.RECONCILE_ORDERS_SWEEP]: (data) =>
    new ReconcileOrdersSweepJobCommand(data as ReconcileOrdersSweepJob),
  [JOBS.MOCK_CAPTURE_SUCCESS]: (data) =>
    new MockCaptureSuccessJobCommand(data as MockCaptureSuccessJob),
};

/** ----- Process queue jobs. ----- **/
@Injectable()
@Processor(QUEUE_NAME)
export class QueueProcessor extends WorkerHost {
  private readonly log = new Logger(QueueProcessor.name);

  constructor(private readonly commandBus: CommandBus) {
    super();
  }

  async process(job: Job<AnyJobData>): Promise<void> {
    // Route queue jobs to CQRS commands.
    try {
      const commandFactory = COMMAND_BY_JOB[job.name as JobName];
      if (!commandFactory) {
        throw new Error(`Unknown job name: ${job.name ?? 'undefined'}`);
      }

      await this.commandBus.execute(commandFactory(job.data));
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
