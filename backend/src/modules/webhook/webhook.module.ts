import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { IdempotencyModule } from '../idempotency/idempotency.module';
import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { WebhooksController } from './webhooks.controller';
import { WebhookRepository } from './webhook.repository';
import { WebhookService } from './webhook.service';

/** ----- Configure webhook module. ----- **/
@Module({
  imports: [HttpModule, IdempotencyModule, CqrsModule],
  controllers: [WebhooksController],
  providers: [
    WebhookService,
    WebhookRepository,
    ...EventHandlers,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
})
export class WebhookModule {}
