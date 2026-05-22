import { Injectable } from '@nestjs/common';

import { PAYMENT_PROVIDER } from '../payment/payment.constant';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { RecordWebhookParams } from './application/commands/idempotency.command';

/** ----- Handle idempotency database access. ----- **/
@Injectable()
export class IdempotencyRepository {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly prisma: PrismaService) {}

  /** ----- Find processed event by event id. ----- **/
  findProcessedExternalEvent(eventId: string) {
    return this.prisma.processedEvent.findUnique({
      where: { eventId },
    });
  }

  /** ----- Find webhook event by external event id. ----- **/
  findWebhookByExternalEventId(eventId: string) {
    return this.prisma.webhookEvent.findUnique({
      where: { eventId },
    });
  }

  /** ----- Create webhook event and processed marker transaction. ----- **/
  recordWebhookAndMarkProcessed(params: RecordWebhookParams) {
    const { eventId, type, payload } = params;
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.webhookEvent.create({
        data: {
          eventId,
          type,
          payload,
        },
      });

      await tx.processedEvent.create({
        data: { eventId, provider: PAYMENT_PROVIDER.PAYPAL },
      });

      return created;
    });
  }
}
