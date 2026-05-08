import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { QUEUE_NAME } from './queue.constant';
import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { QueueController } from './queue.controller';
import { QueueProcessor } from './queue.processor';
import { QueueRepository } from './queue.repository';
import { QueueService } from './queue.service';
import { buildDefaultJobOptions } from './queue.defaults';

/** ----- Configure BullMQ queue module. ----- **/
@Global()
@Module({
  imports: [
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
/** ----- Handle queu odule class ----- **/
export class QueueModule {}
