import { InjectQueue } from '@nestjs/bullmq';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../common/config';
import type { JobsOptions, Queue } from 'bullmq';

import {
  AUDIT_QUEUE,
  EMAIL_QUEUE,
  NOTIFICATION_QUEUE,
} from './enums/bullmq-queue.enum';
import { JOBS, type JobName } from './enums/queue-job.enum';
import { enqueueQueueJob } from './helpers/queue.helper';
import { queueForJob } from './helpers/queue-routing';
import type {
  CapturePaymentJob,
  CreatePaymentIntentJob,
  MockCaptureSuccessJob,
  ProcessWebhookJob,
} from './dto/queue-job.dto';
import { InventoryService } from '../../modules/inventory/inventory.service';
import { OrderStatus } from '../../modules/order/enums/order-status.enum';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { RowLockService } from '../../infrastructure/database/prisma/locks/row-lock.service';

/** ----- Queue enqueue and job-side persistence. ----- **/
@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  /** ----- Handle constructor dependency wiring ----- **/
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLocks: RowLockService,
    @Inject(forwardRef(() => InventoryService))
    private readonly inventory: InventoryService,
    private readonly cfg: AppConfigService,
    @InjectQueue(EMAIL_QUEUE)
    private readonly emailQueue: Queue,
    @InjectQueue(AUDIT_QUEUE)
    private readonly auditQueue: Queue,
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
  ) {}

  /** ----- Enqueue a typed queue job ----- **/
  private enqueue(
    name: JobName,
    data: unknown,
    jobId: string,
    opts?: JobsOptions,
  ): Promise<void> {
    // Route job to email / audit / notification BullMQ queue
    const queue = queueForJob(name, {
      [EMAIL_QUEUE]: this.emailQueue,
      [AUDIT_QUEUE]: this.auditQueue,
      [NOTIFICATION_QUEUE]: this.notificationQueue,
    });
    return enqueueQueueJob({
      queue,
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

  /** ----- Upsert recurring reservation TTL sweep ----- **/
  async upsertExpireReservationsSweep(everyMs: number): Promise<void> {
    await this.enqueue(
      JOBS.EXPIRE_RESERVATIONS_SWEEP,
      {},
      JOBS.EXPIRE_RESERVATIONS_SWEEP,
      {
        repeat: { every: everyMs },
        attempts: 3,
        backoff: { type: 'fixed', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: 50,
      },
    );
  }

  /** ----- Upsert recurring UNPAID order cleanup sweep ----- **/
  async upsertExpireUnpaidOrdersSweep(everyMs: number): Promise<void> {
    await this.enqueue(
      JOBS.EXPIRE_UNPAID_ORDERS_SWEEP,
      {},
      JOBS.EXPIRE_UNPAID_ORDERS_SWEEP,
      {
        repeat: { every: everyMs },
        attempts: 3,
        backoff: { type: 'fixed', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: 50,
      },
    );
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
    const normalizedDelay = this.cfg.mock.captureDelayMs;

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

  /** ----- Lock order for payment intent ----- **/
  lockOrderForPaymentIntent(orderId: string, mockEnabled: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await this.rowLocks.findOrderForPaymentIntentWorker(
        tx,
        orderId,
      );

      if (rows.length === 0) return null;
      const order = rows[0];

      // Terminal paid state — worker should no-op
      if (order.status === OrderStatus.PAID) {
        return { ...order, shouldWork: false };
      }

      // Gateway checkout already created — skip duplicate intent job
      const alreadyCreated =
        !!order.paypalOrderId && (mockEnabled || !!order.approvalUrl);
      if (alreadyCreated) {
        return { ...order, shouldWork: false };
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PROCESSING },
      });

      return { ...order, shouldWork: true };
    });
  }

  /** ----- Save mock gateway order data ----- **/
  saveMockGatewayOrder(orderId: string, paypalOrderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await this.rowLocks.findOrderGatewayFields(tx, orderId);

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
  }

  /** ----- Save gateway order result data ----- **/
  saveGatewayOrderResult(params: {
    orderId: string;
    paypalOrderId: string;
    approvalUrl: string;
  }) {
    const { orderId, paypalOrderId, approvalUrl } = params;
    return this.prisma.$transaction(async (tx) => {
      const rows = await this.rowLocks.findOrderApprovalUrl(tx, orderId);

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

  /** ----- Expire stale processing orders and release stock ----- **/
  async expireProcessingOrders(cutoff: Date) {
    const stale = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PROCESSING,
        updatedAt: { lt: cutoff },
      },
      select: { id: true },
    });

    if (stale.length === 0) {
      return { count: 0 };
    }

    // Expire each stale PROCESSING order in its own transaction
    for (const order of stale) {
      await this.prisma.$transaction(async (tx) => {
        const rows = await this.rowLocks.findOrderStatus(tx, order.id);

        if (rows.length === 0) return;
        if (rows[0].status !== OrderStatus.PROCESSING) return;

        await this.inventory.releaseForOrder(order.id, tx);

        await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.EXPIRED,
            paypalOrderId: null,
            approvalUrl: null,
          },
        });
      });
    }

    return { count: stale.length };
  }
}
