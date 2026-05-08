import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { OrdersController } from './orders.controller';
import { OrderRepository } from './order.repository';
import { OrderService } from './order.service';

/** ----- Configure order module. ----- **/
@Module({
  imports: [CqrsModule],
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
