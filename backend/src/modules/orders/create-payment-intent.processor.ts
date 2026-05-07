import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { randomUUID } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { PaymentDlqService } from '../payments/payment-dlq.service';
import { PayPalService } from '../payments/paypal.service';
import { MockPaymentSchedulerService } from '../payments/mock-payment.scheduler';
import {
  CREATE_PAYMENT_INTENT_JOB,
  CREATE_PAYMENT_INTENT_QUEUE,
  type CreatePaymentIntentJobData,
} from './create-payment-intent.jobs';
import { OrderStatus } from './order-status';

/**
 * Worker that creates PayPal checkout orders (or mock orders) asynchronously.
 * This is intentionally queue-based to support retries and avoid blocking API threads.
 */
@Processor(CREATE_PAYMENT_INTENT_QUEUE)
export class CreatePaymentIntentProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payPal: PayPalService,
    private readonly mockScheduler: MockPaymentSchedulerService,
    private readonly config: ConfigService,
    private readonly dlq: PaymentDlqService,
  ) {
    super();
  }

  async process(job: Job<CreatePaymentIntentJobData>): Promise<void> {
    if (job.name !== CREATE_PAYMENT_INTENT_JOB) return;

    const orderId = job.data.orderId;
    const mockEnabled =
      this.config.get<string>('MOCK_PAYMENT_GATEWAY') === 'true';

    // Step 1: lock and snapshot state; do not call external services in a transaction.
    const snapshot = await this.prisma.$transaction(async (tx) => {
      const rows = (await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          currency: string;
          paypalOrderId: string | null;
          approvalUrl: string | null;
          amount: string;
        }>
      >`
        SELECT id, status::text as status, currency, "paypalOrderId", "approvalUrl", amount::text as amount
        FROM "Order"
        WHERE id = ${orderId}
        FOR UPDATE
      `) as Array<{
        id: string;
        status: string;
        currency: string;
        paypalOrderId: string | null;
        approvalUrl: string | null;
        amount: string;
      }>;

      if (rows.length === 0) return null;

      const order = rows[0];
      if (order.status === OrderStatus.PAID) {
        return { ...order, shouldWork: false };
      }

      const alreadyCreated =
        !!order.paypalOrderId && (mockEnabled || !!order.approvalUrl);
      if (alreadyCreated) {
        return { ...order, shouldWork: false };
      }

      // Mark as processing so concurrent requests observe the correct state.
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PROCESSING },
      });

      return { ...order, shouldWork: true };
    });

    if (!snapshot?.shouldWork) return;

    // Step 2: call external gateway / create mock.
    if (mockEnabled) {
      const paypalOrderId = `MOCK-ORDER-${randomUUID()}`;

      await this.prisma.$transaction(async (tx) => {
        // Re-check under lock to remain idempotent.
        const rows = (await tx.$queryRaw<
          Array<{
            id: string;
            approvalUrl: string | null;
            paypalOrderId: string | null;
          }>
        >`
          SELECT id, "approvalUrl", "paypalOrderId"
          FROM "Order"
          WHERE id = ${orderId}
          FOR UPDATE
        `) as Array<{
          id: string;
          approvalUrl: string | null;
          paypalOrderId: string | null;
        }>;

        if (rows.length === 0) return;
        const current = rows[0];
        if (current.paypalOrderId) return;

        await tx.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.PROCESSING,
            paypalOrderId,
            approvalUrl: null,
          },
        });
      });

      // Enqueue mock capture webhook delivery (retry-safe).
      await this.mockScheduler.scheduleCaptureSuccess({
        internalOrderId: orderId,
        paypalOrderId,
      });
      return;
    }

    const amountStr = Number(snapshot.amount).toFixed(2);
    const currency = snapshot.currency.toUpperCase();

    const { paypalOrderId, approvalUrl } =
      await this.payPal.createCheckoutOrder({
        internalOrderId: orderId,
        amount: amountStr,
        currency,
      });

    // Step 3: persist gateway result atomically (idempotent re-check).
    await this.prisma.$transaction(async (tx) => {
      const rows = (await tx.$queryRaw<
        Array<{ id: string; approvalUrl: string | null }>
      >`
        SELECT id, "approvalUrl"
        FROM "Order"
        WHERE id = ${orderId}
        FOR UPDATE
      `) as Array<{ id: string; approvalUrl: string | null }>;

      if (rows.length === 0) return;
      if (rows[0].approvalUrl) return;

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PROCESSING,
          paypalOrderId,
          approvalUrl,
        },
      });
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(
    job: Job<CreatePaymentIntentJobData>,
    err: Error,
  ): Promise<void> {
    const configuredAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < configuredAttempts) return;

    await this.dlq.enqueue({
      sourceQueue: CREATE_PAYMENT_INTENT_QUEUE,
      sourceJobName: job.name,
      sourceJobId: job.id ?? null,
      attemptsMade: job.attemptsMade,
      configuredAttempts,
      reason: err?.message ?? 'Unknown worker failure',
      payload: job.data,
    });
  }
}
