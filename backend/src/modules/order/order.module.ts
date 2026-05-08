import { Global, Module } from '@nestjs/common';

import { EventBusModule } from '../event-bus/event-bus.module';
import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { OrdersController } from './orders.controller';
import { OrderRepository } from './order.repository';
import { OrderService } from './order.service';

/** ----- Configure order module. ----- **/
@Global()
@Module({
  imports: [EventBusModule],
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
