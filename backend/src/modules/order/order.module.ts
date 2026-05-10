import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { LocksModule } from '../locks/locks.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { OrdersController } from './orders.controller';
import { OrderRepository } from './order.repository';
import { OrderService } from './order.service';

/** ----- Configure order module. ----- **/
@Module({
  imports: [CqrsModule, LocksModule, PrismaModule, QueueModule],
  controllers: [OrdersController],
  providers: [
    OrderService,
    OrderRepository,
    ...EventHandlers,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
})
/** ----- Handle orde odule class ----- **/
export class OrderModule {}
