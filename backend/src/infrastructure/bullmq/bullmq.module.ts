import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { AppConfigModule, AppConfigService } from '../../common/config';
import {
  AuditQueueModule,
  EmailQueueModule,
  NotificationQueueModule,
} from './queues';

/** ----- BullMQ root connection and queue registration. ----- **/
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService) => ({
        connection: {
          host: cfg.redis.host,
          port: cfg.redis.port,
          password: cfg.redis.password,
        },
        prefix: cfg.redis.prefix,
      }),
    }),
    EmailQueueModule,
    AuditQueueModule,
    NotificationQueueModule,
  ],
  exports: [BullModule, EmailQueueModule, AuditQueueModule, NotificationQueueModule],
})
export class BullMqIntegrationModule {}
