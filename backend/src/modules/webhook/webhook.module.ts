import { HttpModule } from '@nestjs/axios';
import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { IdempotencyModule } from '../../infrastructure/idempotency/idempotency.module';
import { InventoryModule } from '../inventory/inventory.module';
import { LocksModule } from '../../infrastructure/locks/locks.module';
import { QueueModule } from '../../infrastructure/queue/queue.module';
import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

/** ----- Configure webhook module. ----- **/
@Module({
  imports: [
    HttpModule,
    IdempotencyModule,
    forwardRef(() => InventoryModule),
    CqrsModule,
    LocksModule,
    forwardRef(() => QueueModule),
  ],
  controllers: [WebhookController],
  providers: [
    WebhookService,
    ...EventHandlers,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [WebhookService],
})
export class WebhookModule {}
