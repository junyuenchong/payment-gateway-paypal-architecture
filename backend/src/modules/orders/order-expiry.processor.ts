import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';

import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from './order-status';
import {
  EXPIRE_ORDERS_SWEEP_JOB,
  ORDER_MAINTENANCE_QUEUE,
  type ExpireOrdersSweepJobData,
} from './order-expiry.jobs';

@Injectable()
@Processor(ORDER_MAINTENANCE_QUEUE)
export class OrderExpiryProcessor extends WorkerHost {
  private readonly log = new Logger(OrderExpiryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<ExpireOrdersSweepJobData>): Promise<void> {
    if (job.name !== EXPIRE_ORDERS_SWEEP_JOB) return;

    const ttlMs = Number(
      this.config.get('ORDER_PROCESSING_EXPIRE_MS') ?? 900000,
    );
    const normalizedTtlMs =
      Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : 900000;

    const cutoff = new Date(Date.now() - normalizedTtlMs);

    const result = await this.prisma.order.updateMany({
      where: {
        status: OrderStatus.PROCESSING,
        updatedAt: { lt: cutoff },
      },
      data: {
        status: OrderStatus.EXPIRED,
        paypalOrderId: null,
        approvalUrl: null,
      },
    });

    if (result.count > 0) {
      this.log.log(`Expired ${result.count} processing order(s)`);
    }
  }
}
