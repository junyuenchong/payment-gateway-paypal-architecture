import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { InventoryModule } from '../inventory/inventory.module';
import { LocksModule } from '../../infrastructure/locks/locks.module';
import { QueueModule } from '../../infrastructure/queue/queue.module';
import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

/** ----- Configure order module. ----- **/
@Module({
  imports: [CqrsModule, LocksModule, InventoryModule, QueueModule],
  controllers: [OrderController],
  providers: [
    OrderService,
    ...EventHandlers,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
})
/** ----- Handle orde odule class ----- **/
export class OrderModule {}
