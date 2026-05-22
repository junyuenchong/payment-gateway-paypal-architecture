import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { LocksModule } from '../locks/locks.module';
import { QueueModule } from '../queue/queue.module';
import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { InventoryController } from './inventory.controller';
import { InventoryRepository } from './inventory.repository';
import { InventorySchedulerService } from './inventory.scheduler';
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
    InventoryRepository,
    InventoryService,
    InventorySchedulerService,
    ...EventHandlers,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
