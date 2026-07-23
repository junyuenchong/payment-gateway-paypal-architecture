import { Logger } from '@nestjs/common';
import type { CommandBus } from '@nestjs/cqrs';
import type { Job } from 'bullmq';

import { toError } from '../../../common/shared/helpers/error.util';
import {
  CapturePaymentJobCommand,
  CreatePaymentIntentJobCommand,
  ExpireOrdersSweepJobCommand,
  ExpireReservationsSweepJobCommand,
  ExpireUnpaidOrdersSweepJobCommand,
  MockCaptureSuccessJobCommand,
  ProcessWebhookJobCommand,
  ReconcileOrdersSweepJobCommand,
} from '../../queue/cqrs/commands/queue-jobs.command';
import type {
  CapturePaymentJob,
  CreatePaymentIntentJob,
  ExpireOrdersSweepJob,
  ExpireReservationsSweepJob,
  ExpireUnpaidOrdersSweepJob,
  MockCaptureSuccessJob,
  ProcessWebhookJob,
  ReconcileOrdersSweepJob,
} from '../../queue/dto/queue-job.dto';
import { JOBS, type JobName } from '../../queue/enums/queue-job.enum';
import { toQueueJobError } from '../../queue/helpers/job-retry.helper';

type AnyJobData =
  | CreatePaymentIntentJob
  | CapturePaymentJob
  | ProcessWebhookJob
  | ExpireOrdersSweepJob
  | ExpireReservationsSweepJob
  | ExpireUnpaidOrdersSweepJob
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
  [JOBS.EXPIRE_RESERVATIONS_SWEEP]: (data) =>
    new ExpireReservationsSweepJobCommand(data as ExpireReservationsSweepJob),
  [JOBS.EXPIRE_UNPAID_ORDERS_SWEEP]: (data) =>
    new ExpireUnpaidOrdersSweepJobCommand(data as ExpireUnpaidOrdersSweepJob),
  [JOBS.RECONCILE_ORDERS_SWEEP]: (data) =>
    new ReconcileOrdersSweepJobCommand(data as ReconcileOrdersSweepJob),
  [JOBS.MOCK_CAPTURE_SUCCESS]: (data) =>
    new MockCaptureSuccessJobCommand(data as MockCaptureSuccessJob),
};

/** ----- Route a BullMQ job to its CQRS command. ----- **/
export async function executeQueueJob(
  commandBus: CommandBus,
  job: Job<AnyJobData>,
  log: Logger,
): Promise<void> {
  try {
    const commandFactory = COMMAND_BY_JOB[job.name as JobName];
    if (!commandFactory) {
      throw new Error(`Unknown job name: ${job.name ?? 'undefined'}`);
    }
    await commandBus.execute(commandFactory(job.data));
  } catch (error: unknown) {
    const normalized = toError(error, 'Queue worker execution failed');
    log.error(`Queue job failed: ${job.name ?? 'undefined'}`);
    log.error(normalized.stack ?? normalized.message);
    throw toQueueJobError(error, 'Queue worker execution failed');
  }
}
