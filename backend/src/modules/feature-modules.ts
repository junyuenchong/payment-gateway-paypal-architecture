import { BullMqIntegrationModule } from '../infrastructure/bullmq/bullmq.module';
import { IdempotencyModule } from '../infrastructure/idempotency/idempotency.module';
import { LocksModule } from '../infrastructure/locks/locks.module';
import { PaymentGatewayModule } from '../infrastructure/payment-gateway/payment-gateway.module';
import { QueueModule } from '../infrastructure/queue/queue.module';
import { ReconciliationModule } from '../infrastructure/reconciliation/reconciliation.module';
import { RedisIntegrationModule } from '../infrastructure/redis/redis.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrderModule } from './order/order.module';
import { PaymentModule } from './payment/payment.module';
import { WebhookModule } from './webhook/webhook.module';

/**
 * App module load order (infrastructure L0 → L1 → domain → L2 workers).
 * See infrastructure/README.md and STRUCTURE.md.
 */
export const FEATURE_MODULES = [
  // L0 — connections
  RedisIntegrationModule,
  BullMqIntegrationModule,
  // L1 — adapters
  LocksModule,
  IdempotencyModule,
  PaymentGatewayModule,
  // Domain
  InventoryModule,
  OrderModule,
  PaymentModule,
  WebhookModule,
  // L2 — async orchestration
  QueueModule,
  ReconciliationModule,
];
