import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';

import { PrismaModule } from '../prisma/prisma.module';
import { WebhookModule } from '../webhook/webhook.module';
import { QUEUE_NAME } from './queue.constant';
import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { QueueController } from './queue.controller';
import { buildDefaultJobOptions } from './queue.defaults';
import { QueueProcessor } from './queue.processor';
import { QueueRepository } from './queue.repository';
import { QueueService } from './queue.service';

/** ----- Configure BullMQ queue module. ----- **/
@Module({
  imports: [
    CqrsModule,
    PrismaModule,
    forwardRef(() => WebhookModule),
    BullModule.registerQueueAsync({
      name: QUEUE_NAME,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        defaultJobOptions: buildDefaultJobOptions(config),
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
