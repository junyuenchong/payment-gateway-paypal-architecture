import { BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Queue } from 'bullmq';

import { RedisLockService } from '../../../locks/redis-lock.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { WebhookEventStatus } from '../../webhook-event-status';
import {
  ReceiveWebhookCommand,
  ReceiveWebhookResult,
} from '../commands/receive-webhook.command';
import {
  WEBHOOK_PROCESS_JOB,
  WEBHOOK_PROCESS_QUEUE,
  type WebhookProcessJobData,
} from '../../webhook-process.jobs';

type PaypalLikePayload = {
  id?: string;
  event_type?: string;
};

@CommandHandler(ReceiveWebhookCommand)
export class ReceiveWebhookHandler implements ICommandHandler<
  ReceiveWebhookCommand,
  ReceiveWebhookResult
> {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(WEBHOOK_PROCESS_QUEUE)
    private readonly webhookProcessQueue: Queue<WebhookProcessJobData>,
    private readonly redisLock: RedisLockService,
  ) {}

  /**
   * ------------------------------------------------------
   * Receive and Persist Webhook Event
   * ------------------------------------------------------
   */
  async execute(command: ReceiveWebhookCommand): Promise<ReceiveWebhookResult> {
    let parsed: PaypalLikePayload;
    try {
      parsed = JSON.parse(
        command.rawBody.toString('utf8'),
      ) as PaypalLikePayload;
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
    if (!lock) {
      return { duplicate: true };
    }

    try {
      const existing = await this.prisma.processedEvent.findUnique({
        where: { eventId },
      });
      if (existing) {
        const webhookEvent = await this.prisma.webhookEvent.findUnique({
          where: { eventId },
        });

        // If we already stored the webhook but haven't processed it yet
        // (e.g. worker scheduling failed), enqueue for processing again.
        if (
          webhookEvent &&
          webhookEvent.status === WebhookEventStatus.RECEIVED
        ) {
          await this.webhookProcessQueue.add(
            WEBHOOK_PROCESS_JOB,
            { webhookEventId: webhookEvent.id },
            {
              jobId: `webhook-${webhookEvent.id}`,
              attempts: 5,
              backoff: { type: 'exponential', delay: 1000 },
              removeOnComplete: true,
              removeOnFail: 100,
            },
          );
        }

        return { duplicate: true };
      }

      const type = String(parsed.event_type ?? 'unknown');

      try {
        const row = await this.prisma.$transaction(async (tx) => {
          const created = await tx.webhookEvent.create({
            data: {
              eventId,
              type,
              payload: parsed,
            },
          });
          await tx.processedEvent.create({
            data: { eventId, provider: 'paypal' },
          });
          return created;
        });

        await this.webhookProcessQueue.add(
          WEBHOOK_PROCESS_JOB,
          { webhookEventId: row.id },
          {
            jobId: `webhook-${row.id}`,
            attempts: 5,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: true,
            removeOnFail: 100,
          },
        );

        return { duplicate: false };
      } catch (e) {
        if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
          return { duplicate: true };
        }
        throw e;
      }
    } finally {
      await this.redisLock.release(lock);
    }
  }
}
