import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Queue } from 'bullmq';

import { RedisLockService } from '../../../locks/redis-lock.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { OrderStatus } from '../../order-status';
import {
  CREATE_PAYMENT_INTENT_JOB,
  CREATE_PAYMENT_INTENT_QUEUE,
  type CreatePaymentIntentJobData,
} from '../../create-payment-intent.jobs';
import {
  CreatePaymentIntentCommand,
  PaymentIntentResult,
} from '../commands/create-payment-intent.command';

@CommandHandler(CreatePaymentIntentCommand)
export class CreatePaymentIntentHandler implements ICommandHandler<
  CreatePaymentIntentCommand,
  PaymentIntentResult
> {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(CREATE_PAYMENT_INTENT_QUEUE)
    private readonly queue: Queue<CreatePaymentIntentJobData>,
    private readonly config: ConfigService,
    private readonly redisLock: RedisLockService,
  ) {}

  /**
   * Create payment intent asynchronously (queue-based).
   * API must be idempotent:
   * - duplicate requests should not create multiple checkout URLs
   * - approvalUrl is produced by the worker; API returns `approvalUrl: null` initially
   */
  async execute(
    command: CreatePaymentIntentCommand,
  ): Promise<PaymentIntentResult> {
    const lock = await this.redisLock.tryAcquire(
      `lock:order:intent:${command.orderId}`,
      15000,
    );
    if (!lock) {
      throw new BadRequestException(
        'Payment intent request is already in progress. Please retry shortly.',
      );
    }

    try {
      const mockEnabled =
        this.config.get<string>('MOCK_PAYMENT_GATEWAY') === 'true';
      const provider: 'PAYPAL' | 'MOCK' = mockEnabled ? 'MOCK' : 'PAYPAL';

      const locked = await this.prisma.$transaction(async (tx) => {
        const rows = (await tx.$queryRaw<
          Array<{
            id: string;
            status: string;
            currency: string;
            paypalOrderId: string | null;
            approvalUrl: string | null;
          }>
        >`
        SELECT
          id,
          status::text as status,
          currency,
          "paypalOrderId",
          "approvalUrl"
        FROM "Order"
        WHERE id = ${command.orderId}
        FOR UPDATE
      `) as Array<{
          id: string;
          status: string;
          currency: string;
          paypalOrderId: string | null;
          approvalUrl: string | null;
        }>;

        if (rows.length === 0) {
          throw new NotFoundException('Order not found');
        }

        const order = rows[0];
        const status = String(order.status);

        // Terminal states: do not create a new checkout.
        if (
          status === OrderStatus.PAID ||
          status === OrderStatus.REFUNDED ||
          status === OrderStatus.PARTIALLY_REFUNDED
        ) {
          return {
            orderId: order.id,
            status,
            paypalOrderId: order.paypalOrderId,
            approvalUrl: null,
            shouldEnqueue: false,
          } as const;
        }

        // Only reuse an existing checkout when it's still in PROCESSING state.
        // If the user cancelled/failed, we should create a fresh checkout.
        const checkoutReady =
          status === OrderStatus.PROCESSING &&
          !!order.paypalOrderId &&
          (mockEnabled || !!order.approvalUrl);

        if (checkoutReady) {
          return {
            orderId: order.id,
            status: OrderStatus.PROCESSING,
            paypalOrderId: order.paypalOrderId,
            approvalUrl: mockEnabled ? null : order.approvalUrl,
            shouldEnqueue: false,
          } as const;
        }

        // Retry-safe: allow UNPAID/FAILED/CANCELLED/PROCESSING (pending creation).
        if (
          status !== OrderStatus.UNPAID &&
          status !== OrderStatus.PROCESSING &&
          status !== OrderStatus.FAILED &&
          status !== OrderStatus.CANCELLED &&
          status !== OrderStatus.EXPIRED
        ) {
          throw new BadRequestException(
            'Order is not in a retryable state to start payment',
          );
        }

        // Mark processing; worker will fill paypalOrderId + approvalUrl later.
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.PROCESSING, approvalUrl: null },
        });

        return {
          orderId: order.id,
          status: OrderStatus.PROCESSING,
          paypalOrderId: order.paypalOrderId,
          approvalUrl: null,
          shouldEnqueue: true,
        } as const;
      });

      if (locked.shouldEnqueue) {
        await this.queue.add(
          CREATE_PAYMENT_INTENT_JOB,
          { orderId: locked.orderId },
          {
            jobId: `create-${locked.orderId}`,
            attempts: 5,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: true,
            removeOnFail: 100,
          },
        );
      }

      return {
        provider,
        orderId: locked.orderId,
        status: locked.status,
        mock: mockEnabled,
        internalOrderId: locked.orderId,
        paypalOrderId: locked.paypalOrderId,
        approvalUrl: locked.approvalUrl,
        message: 'Checkout creation scheduled.',
      };
    } finally {
      await this.redisLock.release(lock);
    }
  }
}
