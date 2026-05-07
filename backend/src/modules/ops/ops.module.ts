import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { CAPTURE_PAYMENT_QUEUE } from '../orders/capture-payment.jobs';
import { CREATE_PAYMENT_INTENT_QUEUE } from '../orders/create-payment-intent.jobs';
import { PAYMENT_DLQ_QUEUE } from '../payments/payment-dlq.jobs';
import { WEBHOOK_PROCESS_QUEUE } from '../webhooks/webhook-process.jobs';
import { OpsController } from './ops.controller';
import { OpsService } from './ops.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: CREATE_PAYMENT_INTENT_QUEUE }),
    BullModule.registerQueue({ name: CAPTURE_PAYMENT_QUEUE }),
    BullModule.registerQueue({ name: WEBHOOK_PROCESS_QUEUE }),
    BullModule.registerQueue({ name: PAYMENT_DLQ_QUEUE }),
  ],
  controllers: [OpsController],
  providers: [OpsService],
})
export class OpsModule {}
