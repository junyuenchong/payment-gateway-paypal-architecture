import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import {
  MOCK_CAPTURE_SUCCESS_JOB,
  MOCK_PAYMENT_QUEUE,
  type MockCaptureSuccessJobData,
} from './mock-payment.jobs';

@Injectable()
export class MockPaymentSchedulerService {
  private readonly log = new Logger(MockPaymentSchedulerService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectQueue(MOCK_PAYMENT_QUEUE)
    private readonly queue: Queue<MockCaptureSuccessJobData>,
  ) {}

  /**
   * ------------------------------------------------------
   * Schedule Mock Capture Success
   * ------------------------------------------------------
   * Simulates PayPal async capture by POSTing a signed payload.
   */
  scheduleCaptureSuccess(params: {
    internalOrderId: string;
    paypalOrderId: string;
  }): Promise<void> {
    const delay = Number(this.config.get('MOCK_CAPTURE_DELAY_MS') ?? 2500);
    const normalizedDelay = Number.isFinite(delay) ? delay : 2500;
    return this.queue
      .add(MOCK_CAPTURE_SUCCESS_JOB, params, {
        delay: normalizedDelay,
        attempts: 3,
        backoff: { type: 'fixed', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: 50,
      })
      .then(() => undefined)
      .catch((err: unknown) => {
        this.log.error('Failed to enqueue mock capture success job');
        this.log.error(err instanceof Error ? err.stack : String(err));
        throw err;
      });
  }
}
