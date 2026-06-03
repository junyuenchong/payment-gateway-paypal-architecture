import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { LocksModule } from '../../infrastructure/locks/locks.module';
import { QueueModule } from '../../infrastructure/queue/queue.module';
import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

/** ----- Configure inventory module. ----- **/
@Module({
  imports: [
    CqrsModule,
    LocksModule,
    forwardRef(() => QueueModule),
  ],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    ...EventHandlers,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
