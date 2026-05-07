import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Queue } from 'bullmq';

import { RedisLockService } from '../../../locks/redis-lock.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { OrderStatus, type OrderStatusCode } from '../../order-status';
import {
  CAPTURE_PAYMENT_JOB,
  CAPTURE_PAYMENT_QUEUE,
  type CapturePaymentJobData,
} from '../../capture-payment.jobs';
import { ScheduleCapturePaymentCommand } from '../commands/schedule-capture-payment.command';
import type { CapturePaymentResult } from '../commands/capture-payment.command';

@Injectable()
@CommandHandler(ScheduleCapturePaymentCommand)
export class ScheduleCapturePaymentHandler implements ICommandHandler<
  ScheduleCapturePaymentCommand,
  CapturePaymentResult
> {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(CAPTURE_PAYMENT_QUEUE)
    private readonly queue: Queue<CapturePaymentJobData>,
    private readonly redisLock: RedisLockService,
  ) {}

  async execute(
    command: ScheduleCapturePaymentCommand,
  ): Promise<CapturePaymentResult> {
    const lock = await this.redisLock.tryAcquire(
      `lock:order:capture:${command.orderId}`,
      15000,
    );
    if (!lock) {
      throw new BadRequestException(
        'Capture request is already in progress. Please retry shortly.',
      );
    }

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: command.orderId },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }
      if (!order.paypalOrderId) {
        throw new BadRequestException('Order has no PayPal order id');
      }

      // If already finished, just return current state.
      if (order.status === OrderStatus.PAID) {
        return {
          orderId: order.id,
          status: OrderStatus.PAID as OrderStatusCode,
          paypalOrderId: order.paypalOrderId,
          message: 'Order already paid.',
        };
      }
      if (
        order.status !== OrderStatus.PROCESSING &&
        order.status !== OrderStatus.FAILED
      ) {
        throw new BadRequestException(
          `Order must be FAILED or PROCESSING to capture (got: ${order.status})`,
        );
      }

      // Enqueue a retry-safe capture job.
      // jobId avoids duplicate jobs for concurrent API retries.
      try {
        await this.queue.add(
          CAPTURE_PAYMENT_JOB,
          { orderId: order.id },
          {
            jobId: `capture-${order.id}`,
            attempts: 5,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: true,
            removeOnFail: 100,
          },
        );
      } catch {
        // If the job already exists, we can safely treat it as already scheduled.
      }

      return {
        orderId: order.id,
        status: OrderStatus.PROCESSING as OrderStatusCode,
        paypalOrderId: order.paypalOrderId,
        message: 'Capture scheduled.',
      };
    } finally {
      await this.redisLock.release(lock);
    }
  }
}
