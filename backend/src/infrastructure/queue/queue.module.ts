import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { BullMqIntegrationModule } from '../bullmq/bullmq.module';
import { AuditWorker, EmailWorker, NotificationWorker } from '../bullmq/workers';
import { InventoryModule } from '../../modules/inventory/inventory.module';
import { PaymentModule } from '../../modules/payment/payment.module';
import { WebhookModule } from '../../modules/webhook/webhook.module';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';
import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';

/** ----- Configure BullMQ queue module (workers + enqueue API). ----- **/
@Module({
  imports: [
    CqrsModule,
    BullMqIntegrationModule,
    PaymentModule,
    forwardRef(() => ReconciliationModule),
    forwardRef(() => InventoryModule),
    forwardRef(() => WebhookModule),
  ],
  controllers: [QueueController],
  providers: [
    QueueService,
    EmailWorker,
    AuditWorker,
    NotificationWorker,
    ...EventHandlers,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [QueueService],
})
export class QueueModule {}
