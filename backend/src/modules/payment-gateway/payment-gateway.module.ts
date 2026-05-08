import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';

import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { PaymentGatewayController } from './payment-gateway.controller';
import { PaymentGatewayRepository } from './payment-gateway.repository';
import { PaymentGatewayService } from './payment-gateway.service';

/** ----- Configure payment gateway module. ----- **/
@Module({
  imports: [ConfigModule, HttpModule, CqrsModule],
  controllers: [PaymentGatewayController],
  providers: [
    PaymentGatewayService,
    PaymentGatewayRepository,
    ...EventHandlers,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [PaymentGatewayService],
})
/** ----- Handle paymen atewa odule class ----- **/
export class PaymentGatewayModule {}
