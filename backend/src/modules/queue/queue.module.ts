import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { AppConfigModule, AppConfigService } from '../../config';
import { InventoryModule } from '../inventory/inventory.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WebhookModule } from '../webhook/webhook.module';
import { QUEUE_NAME } from './queue.constant';
import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { QueueController } from './queue.controller';
import { buildDefaultJobOptions } from './queue.defaults';
import { QueueProcessor } from './processors';
import { QueueRepository } from './queue.repository';
import { QueueService } from './queue.service';

/** ----- Configure BullMQ queue module. ----- **/
@Module({
  imports: [
    CqrsModule,
    forwardRef(() => InventoryModule),
    PrismaModule,
    forwardRef(() => WebhookModule),
    BullModule.registerQueueAsync({
      name: QUEUE_NAME,
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService) => ({
        defaultJobOptions: buildDefaultJobOptions(cfg),
      }),
    }),
  ],
  controllers: [QueueController],
  providers: [
    QueueService,
    QueueRepository,
    QueueProcessor,
    ...EventHandlers,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [QueueService],
})
/** ----- Queue module wiring ----- **/
export class QueueModule {}
