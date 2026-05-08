import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JobsOptions, Queue } from 'bullmq';

import { JOBS, QUEUE_NAME } from './queue.constant';
import { enqueueQueueJob } from './queue.helper';
import type {
  CapturePaymentJob,
  CreatePaymentIntentJob,
  MockCaptureSuccessJob,
  ProcessWebhookJob,
} from './queue.interface';

/** ----- Queue enqueue capabilities ----- **/
@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_NAME)
    private readonly queue: Queue,
  ) {}

  /** ----- Enqueue a typed queue job ----- **/
  private enqueue(
    name: (typeof JOBS)[keyof typeof JOBS],
    data: unknown,
    jobId: string,
    opts?: JobsOptions,
  ): Promise<void> {
    return enqueueQueueJob({
      queue: this.queue,
      logger: this.logger,
      name,
      data,
      jobId,
      opts,
    });
  }

  /** ----- Enqueue create payment intent ----- **/
  async createPaymentIntent(orderId: string): Promise<void> {
    await this.enqueue(
      JOBS.CREATE_PAYMENT_INTENT,
      { orderId } satisfies CreatePaymentIntentJob,
      `create-${orderId}`,
    );
  }

  /** ----- Enqueue capture payment ----- **/
  async capturePayment(orderId: string): Promise<void> {
    await this.enqueue(
      JOBS.CAPTURE_PAYMENT,
      { orderId } satisfies CapturePaymentJob,
      `capture-${orderId}`,
    );
  }

  /** ----- Enqueue webhook processing ----- **/
  async processWebhook(webhookEventId: string): Promise<void> {
    await this.enqueue(
      JOBS.PROCESS_WEBHOOK,
      { webhookEventId } satisfies ProcessWebhookJob,
      `webhook-${webhookEventId}`,
    );
  }

  /** ----- Upsert recurring order expiry sweep ----- **/
  async upsertExpireOrdersSweep(everyMs: number): Promise<void> {
    await this.enqueue(JOBS.EXPIRE_ORDERS_SWEEP, {}, JOBS.EXPIRE_ORDERS_SWEEP, {
      repeat: { every: everyMs },
      attempts: 3,
      backoff: { type: 'fixed', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: 50,
    });
  }

  /** ----- Upsert recurring reconciliation sweep ----- **/
  async upsertReconcileOrdersSweep(everyMs: number): Promise<void> {
    await this.enqueue(
      JOBS.RECONCILE_ORDERS_SWEEP,
      {},
      JOBS.RECONCILE_ORDERS_SWEEP,
      {
        repeat: { every: everyMs },
        attempts: 3,
        backoff: { type: 'fixed', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: 50,
      },
    );
  }

  /** ----- Enqueue delayed mock capture success ----- **/
  async scheduleMockCaptureSuccess(
    params: MockCaptureSuccessJob,
  ): Promise<void> {
    const delay = Number(this.config.get('MOCK_CAPTURE_DELAY_MS') ?? 2500);
    const normalizedDelay = Number.isFinite(delay) ? delay : 2500;

    await this.enqueue(
      JOBS.MOCK_CAPTURE_SUCCESS,
      params,
      `mock-${params.internalOrderId}-${params.paypalOrderId}`,
      {
        delay: normalizedDelay,
        attempts: 3,
        backoff: { type: 'fixed', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: 50,
      },
    );
  }
}
