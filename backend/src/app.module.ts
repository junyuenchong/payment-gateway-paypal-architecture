import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { EventBusModule } from './modules/event-bus/event-bus.module';
import { LocksModule } from './modules/locks/locks.module';
import { OrderModule } from './modules/order/order.module';
import { PaymentGatewayModule } from './modules/payment-gateway/payment-gateway.module';
import { PaymentModule } from './modules/payment/payment.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { QueueModule } from './modules/queue/queue.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { WebhookModule } from './modules/webhook/webhook.module';

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
    EventBusModule,
    LocksModule,
    PrismaModule,
    QueueModule,
    PaymentModule,
    PaymentGatewayModule,
    OrderModule,
    WebhookModule,
    ReconciliationModule,
  ],
})
export class AppModule {}
