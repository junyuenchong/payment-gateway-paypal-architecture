import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { PaymentGatewayController } from './payment-gateway.controller';
import { PaymentGatewayRepository } from './payment-gateway.repository';
import { PaymentGatewayService } from './payment-gateway.service';

const providers = [
  PaymentGatewayService,
  PaymentGatewayRepository,
  ...EventHandlers,
  ...CommandHandlers,
  ...QueryHandlers,
];

/** ----- Configure payment gateway module. ----- **/
@Module({
  imports: [HttpModule, CqrsModule],
  controllers: [PaymentGatewayController],
  providers,
  exports: [PaymentGatewayService],
})
/** ----- Handle payment gateway module class. ----- **/
export class PaymentGatewayModule {}
