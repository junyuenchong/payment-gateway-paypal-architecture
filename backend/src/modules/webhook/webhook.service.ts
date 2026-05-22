import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import { AppConfigService } from '../../config';
import { toError } from '../common/error.util';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { RedisLockService } from '../locks/redis-lock.service';
import { QueueService } from '../queue/queue.service';
import { WebhookRepository } from './webhook.repository';
import { assertValidWebhookSignature } from './webhook.helper';
import type { WebhookAuthHeaders } from './webhook.interface';
const WebhookEventStatus = {
  RECEIVED: 'RECEIVED',
  FAILED: 'FAILED',
  PROCESSED: 'PROCESSED',
} as const;

/** ----- Handle webhoo ervice class ----- **/
@Injectable()
export class WebhookService {
  private readonly log = new Logger(WebhookService.name);

  constructor(
    private readonly cfg: AppConfigService,
    private readonly http: HttpService,
    private readonly idempotency: IdempotencyService,
    private readonly queue: QueueService,
    private readonly redisLock: RedisLockService,
    private readonly repository: WebhookRepository,
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

      const lock = await this.redisLock.tryAcquire(
        `lock:webhook:event:${eventId}`,
        15000,
      );
      if (!lock) return { duplicate: true };

      try {
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
      const row = await this.repository.findWebhookEventById(webhookEventId);
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
        await this.repository.markWebhookFailed({ id: row.id });
        return;
      }

      const rawEventType = payload.event_type;
      const eventType =
        typeof rawEventType === 'string' ? rawEventType : row.type;

      const resourceStatus =
        resource && typeof resource.status === 'string' ? resource.status : '';
      await this.repository.processWebhookEventState({
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
}
