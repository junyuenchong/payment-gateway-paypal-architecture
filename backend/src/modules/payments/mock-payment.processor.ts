import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import {
  MOCK_CAPTURE_SUCCESS_JOB,
  MOCK_PAYMENT_QUEUE,
  type MockCaptureSuccessJobData,
} from './mock-payment.jobs';
import { PaymentDlqService } from './payment-dlq.service';
import { MockPaymentWebhookDeliveryService } from './mock-payment.webhook-delivery';

/**
 * ------------------------------------------------------
 * Process Mock Payment Queue Jobs
 * ------------------------------------------------------
 */
@Processor(MOCK_PAYMENT_QUEUE)
export class MockPaymentProcessor extends WorkerHost {
  private readonly log = new Logger(MockPaymentProcessor.name);

  constructor(
    private readonly webhookDelivery: MockPaymentWebhookDeliveryService,
    private readonly dlq: PaymentDlqService,
  ) {
    super();
  }

  async process(job: Job<MockCaptureSuccessJobData>): Promise<void> {
    if (job.name !== MOCK_CAPTURE_SUCCESS_JOB) {
      this.log.warn(`Unknown mock payment job: ${job.name}`);
      return;
    }

    await this.webhookDelivery.deliverSuccess(job.data);
  }

  @OnWorkerEvent('failed')
  async onFailed(
    job: Job<MockCaptureSuccessJobData>,
    err: Error,
  ): Promise<void> {
    const configuredAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < configuredAttempts) return;

    await this.dlq.enqueue({
      sourceQueue: MOCK_PAYMENT_QUEUE,
      sourceJobName: job.name,
      sourceJobId: job.id ?? null,
      attemptsMade: job.attemptsMade,
      configuredAttempts,
      reason: err?.message ?? 'Unknown worker failure',
      payload: job.data,
    });
  }
}
