import { InventoryModule } from './inventory/inventory.module';
import { LocksModule } from './locks/locks.module';
import { OrderModule } from './order/order.module';
import { PaymentGatewayModule } from './payment-gateway/payment-gateway.module';
import { PaymentModule } from './payment/payment.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { WebhookModule } from './webhook/webhook.module';

/** ----- Register app feature modules in one place. ----- **/
export const FEATURE_MODULES = [
  LocksModule,
  PrismaModule,
  InventoryModule,
  QueueModule,
  PaymentModule,
  PaymentGatewayModule,
  OrderModule,
  WebhookModule,
  ReconciliationModule,
];
