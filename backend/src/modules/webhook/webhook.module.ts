import { HttpModule } from '@nestjs/axios';
import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { IdempotencyModule } from '../idempotency/idempotency.module';
import { InventoryModule } from '../inventory/inventory.module';
import { LocksModule } from '../locks/locks.module';
import { QueueModule } from '../queue/queue.module';
import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { WebhooksController } from './webhooks.controller';
import { WebhookRepository } from './webhook.repository';
import { WebhookService } from './webhook.service';

/** ----- Configure webhook module. ----- **/
@Module({
  imports: [
    HttpModule,
    IdempotencyModule,
    InventoryModule,
    CqrsModule,
    LocksModule,
    forwardRef(() => QueueModule),
  ],
  controllers: [WebhooksController],
  providers: [
    WebhookService,
    WebhookRepository,
    ...EventHandlers,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [WebhookService],
})
export class WebhookModule {}
