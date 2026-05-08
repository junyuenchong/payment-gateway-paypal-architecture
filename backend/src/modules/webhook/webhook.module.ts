import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';

import { EventBusModule } from '../event-bus/event-bus.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { WebhooksController } from './webhooks.controller';
import { WebhookRepository } from './webhook.repository';
import { WebhookService } from './webhook.service';

/** ----- Configure webhook module. ----- **/
@Global()
@Module({
  imports: [HttpModule, EventBusModule, IdempotencyModule],
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
