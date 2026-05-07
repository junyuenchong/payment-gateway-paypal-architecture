import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { CommandBus } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { PaymentDlqService } from '../payments/payment-dlq.service';
import {
  CAPTURE_PAYMENT_JOB,
  CAPTURE_PAYMENT_QUEUE,
  type CapturePaymentJobData,
} from './capture-payment.jobs';
import { CapturePaymentCommand } from './application/commands/capture-payment.command';

@Processor(CAPTURE_PAYMENT_QUEUE)
export class CapturePaymentProcessor extends WorkerHost {
  private readonly log = new Logger(CapturePaymentProcessor.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly dlq: PaymentDlqService,
  ) {
    super();
  }

  async process(job: Job<CapturePaymentJobData>): Promise<void> {
    if (job.name !== CAPTURE_PAYMENT_JOB) {
      this.log.warn(`Unknown capture payment job: ${job.name}`);
      return;
    }

    await this.commandBus.execute(new CapturePaymentCommand(job.data.orderId));
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<CapturePaymentJobData>, err: Error): Promise<void> {
    const configuredAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < configuredAttempts) return;

    await this.dlq.enqueue({
      sourceQueue: CAPTURE_PAYMENT_QUEUE,
      sourceJobName: job.name,
      sourceJobId: job.id ?? null,
      attemptsMade: job.attemptsMade,
      configuredAttempts,
      reason: err?.message ?? 'Unknown worker failure',
      payload: job.data,
    });
  }
}
