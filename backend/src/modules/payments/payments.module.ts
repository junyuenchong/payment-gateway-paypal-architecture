import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { MOCK_PAYMENT_QUEUE } from './mock-payment.jobs';
import { PAYMENT_DLQ_QUEUE } from './payment-dlq.jobs';
import { PaymentDlqService } from './payment-dlq.service';
import { MockPaymentProcessor } from './mock-payment.processor';
import { MockPaymentWebhookDeliveryService } from './mock-payment.webhook-delivery';
import { MockPaymentSchedulerService } from './mock-payment.scheduler';
import { PayPalService } from './paypal.service';

const Imports = [
  ConfigModule,
  HttpModule,
  BullModule.registerQueue({
    name: MOCK_PAYMENT_QUEUE,
  }),
  BullModule.registerQueue({
    name: PAYMENT_DLQ_QUEUE,
  }),
];
const Providers = [
  PayPalService,
  PaymentDlqService,
  MockPaymentSchedulerService,
  MockPaymentWebhookDeliveryService,
  MockPaymentProcessor,
];
const Exports = [...Providers];

@Global()
@Module({
  imports: [...Imports],
  providers: [...Providers],
  exports: [...Exports],
})
export class PaymentsModule {}
