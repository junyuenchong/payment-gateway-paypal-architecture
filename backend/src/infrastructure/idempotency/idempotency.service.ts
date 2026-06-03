import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { toError } from '../../common/shared/helpers/error.util';
import type { RecordWebhookParams } from './dto/idempotency.dto';
import { PROCESSED_EVENT_PROVIDER } from './enums/processed-event-provider.enum';

/** ----- Webhook idempotency (ProcessedEvent + WebhookEvent). ----- **/
@Injectable()
export class IdempotencyService {
  private readonly log = new Logger(IdempotencyService.name);

  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly prisma: PrismaService) {}

  /** ----- Find processed marker by external event id. ----- **/
  findProcessedExternalEvent(eventId: string) {
    return this.prisma.processedEvent
      .findUnique({ where: { eventId } })
      .catch((error: unknown) => {
        const normalized = toError(error, 'Find processed event failed');
        this.log.error(`Failed to find processed event: ${eventId}`);
        this.log.error(normalized.stack ?? normalized.message);
        throw normalized;
      });
  }

  /** ----- Find webhook row by external event id. ----- **/
  findWebhookByExternalEventId(eventId: string) {
    return this.prisma.webhookEvent
      .findUnique({ where: { eventId } })
      .catch((error: unknown) => {
        const normalized = toError(error, 'Find webhook event failed');
        this.log.error(`Failed to find webhook event: ${eventId}`);
        this.log.error(normalized.stack ?? normalized.message);
        throw normalized;
      });
  }

  /** ----- Save webhook event and processed marker in one transaction. ----- **/
  recordWebhookAndMarkProcessed(params: RecordWebhookParams) {
    const { eventId, type, payload } = params;
    return this.prisma
      .$transaction(async (tx) => {
        const created = await tx.webhookEvent.create({
          data: { eventId, type, payload },
        });
        await tx.processedEvent.create({
          data: { eventId, provider: PROCESSED_EVENT_PROVIDER.PAYPAL },
        });
        return created;
      })
      .catch((error: unknown) => {
        const normalized = toError(error, 'Record webhook failed');
        this.log.error(
          `Failed to record webhook and marker: ${params.eventId ?? 'undefined'}`,
        );
        this.log.error(normalized.stack ?? normalized.message);
        throw normalized;
      });
  }
}
