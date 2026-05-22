import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { AppConfigModule, AppConfigService } from '../../config';

/** ----- BullMQ root connection (queues register in domain modules). ----- **/
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
  ],
  exports: [BullModule],
})
export class BullMqIntegrationModule {}
