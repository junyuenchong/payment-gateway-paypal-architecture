import { Injectable } from '@nestjs/common';

import { InventoryService } from '../inventory/inventory.service';
import { OrderStatus, type OrderStatusCode } from '../order/enums/order-status.enum';
import { WebhookEventStatus } from './enums/webhook-event-status.enum';
import { PrismaService } from '../../database/prisma/prisma.service';

/** ----- Handle webhook database access. ----- **/
@Injectable()
export class WebhookRepository {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  /** ----- Handle fin ebhoo ven  d method ----- **/
  findWebhookEventById(id: string) {
    return this.prisma.webhookEvent.findUnique({ where: { id } });
  }

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
      const webhookRows = (await tx.$queryRaw<
        Array<{ id: string; status: string }>
      >`
        SELECT id, status
        FROM "WebhookEvent"
        WHERE id = ${webhookEventId}
        FOR UPDATE
      `) as Array<{ id: string; status: string }>;

      if (webhookRows.length === 0) return;
      if (webhookRows[0].status === WebhookEventStatus.PROCESSED) return;

      const orderRows = (await tx.$queryRaw<
        Array<{ id: string; status: string }>
      >`
        SELECT id, status
        FROM "Order"
        WHERE id = ${orderId}
        FOR UPDATE
      `) as Array<{ id: string; status: string }>;

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
