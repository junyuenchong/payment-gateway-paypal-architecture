import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';

import { HealthController } from './modules/health/health.controller';
import { LocksModule } from './modules/locks/locks.module';
import { OpsModule } from './modules/ops/ops.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

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
      }),
    }),
    CqrsModule,
    LocksModule,
    PrismaModule,
    PaymentsModule,
    OrdersModule,
    WebhooksModule,
    OpsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
