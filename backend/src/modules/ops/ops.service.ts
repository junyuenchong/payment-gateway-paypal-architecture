import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { JobsOptions, Queue } from 'bullmq';

import {
  CAPTURE_PAYMENT_QUEUE,
  type CapturePaymentJobData,
} from '../orders/capture-payment.jobs';
import {
  CREATE_PAYMENT_INTENT_QUEUE,
  type CreatePaymentIntentJobData,
} from '../orders/create-payment-intent.jobs';
import {
  PAYMENT_DLQ_QUEUE,
  type PaymentDlqJobData,
} from '../payments/payment-dlq.jobs';
import {
  WEBHOOK_PROCESS_QUEUE,
  type WebhookProcessJobData,
} from '../webhooks/webhook-process.jobs';

type ReplayPayload =
  | CreatePaymentIntentJobData
  | CapturePaymentJobData
  | WebhookProcessJobData;

@Injectable()
export class OpsService {
  private readonly replayableQueues: Record<string, Queue<ReplayPayload>>;

  constructor(
    @InjectQueue(PAYMENT_DLQ_QUEUE)
    private readonly dlqQueue: Queue<PaymentDlqJobData>,
    @InjectQueue(CREATE_PAYMENT_INTENT_QUEUE)
    private readonly createIntentQueue: Queue<CreatePaymentIntentJobData>,
    @InjectQueue(CAPTURE_PAYMENT_QUEUE)
    private readonly captureQueue: Queue<CapturePaymentJobData>,
    @InjectQueue(WEBHOOK_PROCESS_QUEUE)
    private readonly webhookQueue: Queue<WebhookProcessJobData>,
  ) {
    this.replayableQueues = {
      [CREATE_PAYMENT_INTENT_QUEUE]: this
        .createIntentQueue as Queue<ReplayPayload>,
      [CAPTURE_PAYMENT_QUEUE]: this.captureQueue as Queue<ReplayPayload>,
      [WEBHOOK_PROCESS_QUEUE]: this.webhookQueue as Queue<ReplayPayload>,
    };
  }

  async getMetrics() {
    const [createIntent, capture, webhook, dlq] = await Promise.all([
      this.createIntentQueue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
      ),
      this.captureQueue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
      ),
      this.webhookQueue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
      ),
      this.dlqQueue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
      ),
    ]);

    return {
      queues: {
        [CREATE_PAYMENT_INTENT_QUEUE]: createIntent,
        [CAPTURE_PAYMENT_QUEUE]: capture,
        [WEBHOOK_PROCESS_QUEUE]: webhook,
        [PAYMENT_DLQ_QUEUE]: dlq,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async listDlq(limit: number) {
    const size =
      Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    const jobs = await this.dlqQueue.getJobs(
      ['waiting', 'active', 'delayed', 'failed'],
      0,
      size - 1,
      true,
    );

    return jobs.map((job) => ({
      id: job.id,
      name: job.name,
      state: job.finishedOn ? 'finished' : 'pending',
      attemptsMade: job.attemptsMade,
      data: job.data,
      failedReason: job.failedReason ?? null,
      timestamp: job.timestamp,
    }));
  }

  async replayDlqJob(jobId: string) {
    const job = await this.dlqQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`DLQ job not found: ${jobId}`);
    }

    const data = job.data;
    const targetQueue = this.replayableQueues[data.sourceQueue];
    if (!targetQueue) {
      throw new NotFoundException(
        `Unsupported source queue: ${data.sourceQueue}`,
      );
    }

    const replayOptions: JobsOptions = {
      attempts: data.configuredAttempts,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: 100,
    };

    await targetQueue.add(
      data.sourceJobName,
      data.payload as ReplayPayload,
      replayOptions,
    );

    await job.remove();

    return {
      replayed: true,
      sourceDlqJobId: jobId,
      targetQueue: data.sourceQueue,
      targetJobName: data.sourceJobName,
      replayedAt: new Date().toISOString(),
    };
  }
}
