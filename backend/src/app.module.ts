import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppConfigModule, AppConfigService } from './common/config';
import { rateLimitTracker } from './common/shared/helpers/rate-limit.util';
import { PrismaModule } from './infrastructure/database/prisma/prisma.module';
import { FEATURE_MODULES } from './modules/feature-modules';

/** ----- Configure root application module. ----- **/
@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    ThrottlerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: cfg.rateLimit.ttlMs,
            limit: cfg.rateLimit.limit,
          },
        ],
        getTracker: rateLimitTracker,
        errorMessage: 'Too many requests. Please retry later.',
      }),
    }),
    ...FEATURE_MODULES,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
