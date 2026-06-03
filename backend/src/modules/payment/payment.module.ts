import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { PaymentGatewayModule } from '../../infrastructure/payment-gateway/payment-gateway.module';
import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

const providers = [
  PaymentService,
  ...EventHandlers,
  ...CommandHandlers,
  ...QueryHandlers,
];

/** ----- Configure payment module. ----- **/
@Module({
  imports: [CqrsModule, PaymentGatewayModule],
  controllers: [PaymentController],
  providers,
  exports: [PaymentService],
})
/** ----- Handle payment module class. ----- **/
export class PaymentModule {}
