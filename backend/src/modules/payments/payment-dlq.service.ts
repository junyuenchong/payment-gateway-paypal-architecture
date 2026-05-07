import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

import {
  PAYMENT_DLQ_JOB,
  PAYMENT_DLQ_QUEUE,
  type PaymentDlqJobData,
} from './payment-dlq.jobs';

@Injectable()
export class PaymentDlqService {
  constructor(
    @InjectQueue(PAYMENT_DLQ_QUEUE)
    private readonly queue: Queue<PaymentDlqJobData>,
  ) {}

  async enqueue(data: Omit<PaymentDlqJobData, 'failedAt'>): Promise<void> {
    await this.queue.add(
      PAYMENT_DLQ_JOB,
      {
        ...data,
        failedAt: new Date().toISOString(),
      },
      {
        jobId: `dlq-${data.sourceQueue}-${data.sourceJobName}-${data.sourceJobId ?? 'unknown'}-${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: 500,
      },
    );
  }
}
