import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { AppConfigModule, AppConfigService } from '../../common/config';
import { PAYMENT_GATEWAY_PORT } from './contracts/payment-gateway.port';
import { MockPaymentGateway } from './gateways/mock.gateway';
import { PaypalPaymentGateway } from './gateways/paypal.gateway';
import { PaymentGatewayController } from './payment-gateway.controller';
import { PaymentGatewayService } from './payment-gateway.service';

/** ----- Configure payment gateway module. ----- **/
@Module({
  imports: [HttpModule, AppConfigModule],
  controllers: [PaymentGatewayController],
  providers: [
    PaypalPaymentGateway,
    MockPaymentGateway,
    {
      provide: PAYMENT_GATEWAY_PORT,
      inject: [AppConfigService, PaypalPaymentGateway, MockPaymentGateway],
      useFactory: (
        cfg: AppConfigService,
        paypal: PaypalPaymentGateway,
        mock: MockPaymentGateway,
      ) => (cfg.isMockPaymentGateway ? mock : paypal),
    },
    PaymentGatewayService,
  ],
  exports: [PaymentGatewayService, PAYMENT_GATEWAY_PORT],
})
export class PaymentGatewayModule {}
