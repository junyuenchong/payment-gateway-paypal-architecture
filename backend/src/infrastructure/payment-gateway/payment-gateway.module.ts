import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { PaymentGatewayController } from './payment-gateway.controller';
import { PaymentGatewayService } from './payment-gateway.service';

/** ----- Configure payment gateway module. ----- **/
@Module({
  imports: [HttpModule],
  controllers: [PaymentGatewayController],
  providers: [PaymentGatewayService],
  exports: [PaymentGatewayService],
})
export class PaymentGatewayModule {}
