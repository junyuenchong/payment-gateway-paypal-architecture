import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { PaymentController } from './payment.controller';
import { PaymentRepository } from './payment.repository';
import { PaymentService } from './payment.service';

/** ----- Configure payment module. ----- **/
@Module({
  imports: [CqrsModule],
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
