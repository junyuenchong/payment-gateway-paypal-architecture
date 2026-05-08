import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { EventBusModule } from '../event-bus/event-bus.module';
import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { PaymentGatewayController } from './payment-gateway.controller';
import { PaymentGatewayRepository } from './payment-gateway.repository';
import { PaymentGatewayService } from './payment-gateway.service';

/** ----- Configure payment gateway module. ----- **/
@Global()
@Module({
  imports: [ConfigModule, HttpModule, EventBusModule],
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
