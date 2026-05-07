import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BullModule } from '@nestjs/bullmq';

import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { OrdersController } from './orders.controller';
import { CAPTURE_PAYMENT_QUEUE } from './capture-payment.jobs';
import { CapturePaymentProcessor } from './capture-payment.processor';
import { CREATE_PAYMENT_INTENT_QUEUE } from './create-payment-intent.jobs';
import { CreatePaymentIntentProcessor } from './create-payment-intent.processor';
import { ORDER_MAINTENANCE_QUEUE } from './order-expiry.jobs';
import { OrderExpiryProcessor } from './order-expiry.processor';
import { OrderExpirySchedulerService } from './order-expiry.scheduler';

const Imports = [
  CqrsModule,
  BullModule.registerQueue({ name: CAPTURE_PAYMENT_QUEUE }),
  BullModule.registerQueue({ name: CREATE_PAYMENT_INTENT_QUEUE }),
  BullModule.registerQueue({ name: ORDER_MAINTENANCE_QUEUE }),
];
const Controllers = [OrdersController];
const Providers = [
  ...EventHandlers,
  ...CommandHandlers,
  ...QueryHandlers,
  CapturePaymentProcessor,
  CreatePaymentIntentProcessor,
  OrderExpiryProcessor,
  OrderExpirySchedulerService,
];

@Module({
  imports: [...Imports],
  controllers: [...Controllers],
  providers: [...Providers],
})
export class OrdersModule {}
