import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { FEATURE_MODULES } from './modules/feature-modules';

/** ----- Configure root application module. ----- **/
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('BULLMQ_REDIS_HOST') ?? 'localhost',
          port: Number(config.get<string>('BULLMQ_REDIS_PORT') ?? 6379),
          password: config.get<string>('BULLMQ_REDIS_PASSWORD') || undefined,
        },
        prefix:
          config.get<string>('BULLMQ_PREFIX') ??
          `paymentwebhook-${config.get<string>('NODE_ENV') ?? 'dev'}`,
      }),
    }),
    ...FEATURE_MODULES,
  ],
})
export class AppModule {}
