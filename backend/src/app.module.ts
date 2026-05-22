import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { AppConfigModule, AppConfigService } from './config';
import { FEATURE_MODULES } from './modules/feature-modules';

/** ----- Configure root application module. ----- **/
@Module({
  imports: [
    AppConfigModule,
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
    ...FEATURE_MODULES,
  ],
})
export class AppModule {}
