import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, type OrderStatusCode } from '../orders/order-status';
import { WebhookEventStatus } from './webhook-event-status';

type PaypalLikePayload = {
  id?: string;
  event_type?: string;
  resource?: {
    custom_id?: string;
    status?: string;
  };
};

/**
 * Encapsulates webhook -> order status transition logic.
 * Must be retry-safe and safe for concurrent executions.
 */
@Injectable()
export class WebhookProcessService {
  constructor(private readonly prisma: PrismaService) {}

  async processWebhookEvent(webhookEventId: string): Promise<void> {
    // Load outside transaction for payload parsing; processing below is locked.
    const row = await this.prisma.webhookEvent.findUnique({
      where: { id: webhookEventId },
    });

    if (!row) return;
    if (row.status === WebhookEventStatus.PROCESSED) return;

    const payload = row.payload as unknown as PaypalLikePayload;
    const resource = payload.resource;
    const orderId =
      resource && typeof resource.custom_id === 'string'
        ? resource.custom_id
        : undefined;

    if (!orderId) {
      await this.prisma.webhookEvent.update({
        where: { id: row.id },
        data: { status: WebhookEventStatus.FAILED, processedAt: new Date() },
      });
      return;
    }

    const rawEventType = payload.event_type;
    const eventType =
      typeof rawEventType === 'string' ? rawEventType : row.type;

    // Row lock to prevent concurrent updates from different webhook deliveries/retries.
    await this.prisma.$transaction(async (tx) => {
      // Lock the webhook row too; avoids concurrent workers processing the same event.
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
          where: { id: row.id },
          data: {
            status: WebhookEventStatus.FAILED,
            processedAt: new Date(),
            orderId,
          },
        });
        return;
      }

      const currentStatus = orderRows[0].status;

      const resourceStatus =
        resource && typeof resource.status === 'string' ? resource.status : '';

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
        // Avoid regressing a terminal/finished order.
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

      // Apply transition and mark webhook processed atomically.
      await tx.order.update({
        where: { id: orderId },
        data: { status: nextStatus },
      });

      await tx.webhookEvent.update({
        where: { id: row.id },
        data: {
          status: WebhookEventStatus.PROCESSED,
          processedAt: new Date(),
          orderId,
        },
      });
    });
  }
}
