import { Global, Module } from '@nestjs/common';

import { EventBusModule } from '../event-bus/event-bus.module';
import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { PaymentController } from './payment.controller';
import { PaymentRepository } from './payment.repository';
import { PaymentService } from './payment.service';

/** ----- Configure payment module. ----- **/
@Global()
@Module({
  imports: [EventBusModule],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    PaymentRepository,
    ...EventHandlers,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [PaymentService],
})
/** ----- Handle paymen odule class ----- **/
export class PaymentModule {}
