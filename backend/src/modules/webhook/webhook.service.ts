import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import { AppConfigService } from '../../common/config';
import { toError } from '../../common/shared/helpers/error.util';
import { IdempotencyService } from '../../infrastructure/idempotency/idempotency.service';
import { RedisLockService } from '../../infrastructure/locks/redis-lock.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrderStatus, type OrderStatusCode } from '../order/enums/order-status.enum';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { RowLockService } from '../../infrastructure/database/prisma/locks/row-lock.service';
import { WebhookEventStatus } from './enums/webhook-event-status.enum';
import { assertValidWebhookSignature } from './helpers/webhook.helper';
import type { WebhookAuthHeaders } from './dto/webhook.interface';

/** ----- Handle webhook service. ----- **/
@Injectable()
export class WebhookService {
  private readonly log = new Logger(WebhookService.name);

  /** ----- Handle constructor dependency wiring ----- **/
  constructor(
    private readonly cfg: AppConfigService,
    private readonly http: HttpService,
    private readonly prisma: PrismaService,
    private readonly rowLocks: RowLockService,
    private readonly inventory: InventoryService,
    private readonly idempotency: IdempotencyService,
    private readonly queue: QueueService,
    private readonly redisLock: RedisLockService,
  ) {}

  /** ----- Verify, store, and enqueue webhook event. ----- **/
  async receivePayPalWebhook(params: {
    rawBody: Buffer | undefined;
    headers: WebhookAuthHeaders;
  }) {
    try {
      const rawBody = params.rawBody;
      if (!rawBody?.length) {
        throw new BadRequestException('Missing raw webhook body');
      }

      // Verify PayPal (or mock) signature before parsing payload
      await assertValidWebhookSignature({
        cfg: this.cfg,
        http: this.http,
        rawBody,
        mockSignatureHeader: params.headers.mockSig,
        paypalTransmissionId: params.headers.paypalTransmissionId,
        paypalTransmissionTime: params.headers.paypalTransmissionTime,
        paypalTransmissionSig: params.headers.paypalTransmissionSig,
        paypalCertUrl: params.headers.paypalCertUrl,
        paypalAuthAlgo: params.headers.paypalAuthAlgo,
      });

      let parsed: { id?: string; event_type?: string };
      try {
        parsed = JSON.parse(rawBody.toString('utf8')) as {
          id?: string;
          event_type?: string;
        };
      } catch {
        throw new BadRequestException('Invalid JSON payload');
      }

      const eventId = parsed.id;
      if (!eventId) {
        throw new BadRequestException('Missing event id');
      }

      // Serialize ingest per external event id across instances
      const lock = await this.redisLock.tryAcquire(
        `lock:webhook:event:${eventId}`,
        15000,
      );
      if (!lock) return { duplicate: true };

      try {
        // Short-circuit if provider event was already accepted
        const existing: unknown =
          await this.idempotency.findProcessedExternalEvent(eventId);
        if (existing) {
          const webhookEvent: unknown =
            await this.idempotency.findWebhookByExternalEventId(eventId);
          if (webhookEvent) {
            const status = (webhookEvent as { status?: unknown }).status;
            const id = (webhookEvent as { id?: unknown }).id;
            if (
              status === WebhookEventStatus.RECEIVED &&
              typeof id === 'string'
            ) {
              await this.queue.processWebhook(id);
            }
          }
          return { duplicate: true };
        }

        const type = String(parsed.event_type ?? 'unknown');

        try {
          // Persist webhook row + processed marker, then enqueue async handler
          const row: unknown =
            await this.idempotency.recordWebhookAndMarkProcessed({
              eventId,
              type,
              payload: parsed,
            });

          const rowId = (row as { id?: unknown }).id;
          if (typeof rowId === 'string') {
            await this.queue.processWebhook(rowId);
          }
          return { duplicate: false };
        } catch (e) {
          if (
            e instanceof PrismaClientKnownRequestError &&
            e.code === 'P2002'
          ) {
            return { duplicate: true };
          }
          throw e;
        }
      } finally {
        await this.redisLock.release(lock);
      }
    } catch (error: unknown) {
      const normalized = toError(error, 'Receive webhook failed');
      this.log.error('receivePayPalWebhook failed');
      this.log.error(normalized.stack ?? normalized.message);
      throw normalized;
    }
  }

  /** ----- Process stored webhook event. ----- **/
  async processWebhookEvent(webhookEventId: string): Promise<void> {
    try {
      const row = await this.findWebhookEventById(webhookEventId);
      if (!row) return;
      if (row.status === WebhookEventStatus.PROCESSED) return;

      const payload = row.payload as unknown as {
        event_type?: string;
        resource?: { custom_id?: string; status?: string };
      };
      const resource = payload.resource;
      const orderId =
        resource && typeof resource.custom_id === 'string'
          ? resource.custom_id
          : undefined;

      if (!orderId) {
        await this.markWebhookFailed({ id: row.id });
        return;
      }

      const rawEventType = payload.event_type;
      const eventType =
        typeof rawEventType === 'string' ? rawEventType : row.type;

      const resourceStatus =
        resource && typeof resource.status === 'string' ? resource.status : '';
      await this.processWebhookEventState({
        webhookEventId,
        rowId: row.id,
        orderId,
        eventType,
        resourceStatus,
      });
    } catch (error: unknown) {
      const normalized = toError(error, 'Process webhook event failed');
      this.log.error(`processWebhookEvent failed: ${webhookEventId}`);
      this.log.error(normalized.stack ?? normalized.message);
      throw normalized;
    }
  }

  /** ----- Load webhook event row by primary key. ----- **/
  findWebhookEventById(id: string) {
    return this.prisma.webhookEvent.findUnique({ where: { id } });
  }

  /** ----- Mark webhook event failed after unrecoverable parse. ----- **/
  markWebhookFailed(params: { id: string; orderId?: string }) {
    const { id, orderId } = params;
    return this.prisma.webhookEvent.update({
      where: { id },
      data: {
        status: WebhookEventStatus.FAILED,
        processedAt: new Date(),
        ...(orderId ? { orderId } : {}),
      },
    });
  }

  /** ----- Apply webhook outcome to order and inventory in one transaction. ----- **/
  processWebhookEventState(params: {
    webhookEventId: string;
    rowId: string;
    orderId: string;
    eventType: string;
    resourceStatus: string;
  }) {
    const { webhookEventId, rowId, orderId, eventType, resourceStatus } =
      params;

    return this.prisma.$transaction(async (tx) => {
      const webhookRows = await this.rowLocks.findWebhookEventStatus(
        tx,
        webhookEventId,
      );

      if (webhookRows.length === 0) return;
      if (webhookRows[0].status === WebhookEventStatus.PROCESSED) return;

      const orderRows = await this.rowLocks.findOrderIdAndStatus(tx, orderId);

      if (orderRows.length === 0) {
        await tx.webhookEvent.update({
          where: { id: rowId },
          data: {
            status: WebhookEventStatus.FAILED,
            processedAt: new Date(),
            orderId,
          },
        });
        return;
      }

      const currentStatus = orderRows[0].status;
      let nextStatus = currentStatus as OrderStatusCode;

      const failed =
        eventType.includes('FAILED') ||
        resourceStatus.toUpperCase() === 'FAILED';
      const cancelled =
        eventType.includes('CANCELLED') ||
        eventType.includes('CANCELED') ||
        eventType.includes('DENIED') ||
        resourceStatus.toUpperCase() === 'CANCELLED' ||
        resourceStatus.toUpperCase() === 'CANCELED' ||
        resourceStatus.toUpperCase() === 'VOIDED';

      const success =
        !failed &&
        !cancelled &&
        (eventType.includes('SUCCEEDED') ||
          eventType.includes('COMPLETED') ||
          resourceStatus.toUpperCase() === 'COMPLETED');

      if (failed) {
        if (
          currentStatus !== OrderStatus.PAID &&
          currentStatus !== OrderStatus.REFUNDED &&
          currentStatus !== OrderStatus.PARTIALLY_REFUNDED &&
          currentStatus !== OrderStatus.REFUNDING
        ) {
          nextStatus = OrderStatus.FAILED;
        }
      } else if (cancelled) {
        if (
          currentStatus !== OrderStatus.PAID &&
          currentStatus !== OrderStatus.REFUNDED &&
          currentStatus !== OrderStatus.PARTIALLY_REFUNDED &&
          currentStatus !== OrderStatus.REFUNDING
        ) {
          nextStatus = OrderStatus.CANCELLED;
        }
      } else if (success && currentStatus === OrderStatus.PROCESSING) {
        nextStatus = OrderStatus.PAID;
      }

      const refunded =
        eventType.includes('REFUND') ||
        resourceStatus.toUpperCase().includes('REFUND');
      if (
        refunded &&
        (currentStatus === OrderStatus.PAID ||
          currentStatus === OrderStatus.PARTIALLY_REFUNDED)
      ) {
        nextStatus = OrderStatus.REFUNDED;
      }

      if (nextStatus !== currentStatus) {
        if (nextStatus === OrderStatus.PAID) {
          await this.inventory.commitForOrder(orderId, tx);
        } else if (nextStatus === OrderStatus.REFUNDED) {
          await this.inventory.restoreForRefund(orderId, tx);
        } else if (
          nextStatus === OrderStatus.FAILED ||
          nextStatus === OrderStatus.CANCELLED
        ) {
          await this.inventory.releaseForOrder(orderId, tx);
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: nextStatus },
      });

      await tx.webhookEvent.update({
        where: { id: rowId },
        data: {
          status: WebhookEventStatus.PROCESSED,
          processedAt: new Date(),
          orderId,
        },
      });
    });
  }
}
