import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { PaymentDlqService } from '../payments/payment-dlq.service';
import {
  WEBHOOK_PROCESS_JOB,
  WEBHOOK_PROCESS_QUEUE,
  type WebhookProcessJobData,
} from './webhook-process.jobs';
import { WebhookProcessService } from './webhook-process.service';

/**
 * ------------------------------------------------------
 * Process PayPal Webhook Jobs
 * ------------------------------------------------------
 */
@Processor(WEBHOOK_PROCESS_QUEUE)
export class WebhookProcessProcessor extends WorkerHost {
  private readonly log = new Logger(WebhookProcessProcessor.name);

  constructor(
    private readonly processService: WebhookProcessService,
    private readonly dlq: PaymentDlqService,
  ) {
    super();
  }

  async process(job: Job<WebhookProcessJobData>): Promise<void> {
    if (job.name !== WEBHOOK_PROCESS_JOB) {
      this.log.warn(`Unknown webhook process job: ${job.name}`);
      return;
    }
    await this.processService.processWebhookEvent(job.data.webhookEventId);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<WebhookProcessJobData>, err: Error): Promise<void> {
    const configuredAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < configuredAttempts) return;

    await this.dlq.enqueue({
      sourceQueue: WEBHOOK_PROCESS_QUEUE,
      sourceJobName: job.name,
      sourceJobId: job.id ?? null,
      attemptsMade: job.attemptsMade,
      configuredAttempts,
      reason: err?.message ?? 'Unknown worker failure',
      payload: job.data,
    });
  }
}
