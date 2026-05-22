import { InventoryModule } from './inventory/inventory.module';
import { LocksModule } from './locks/locks.module';
import { OrderModule } from './order/order.module';
import { PaymentGatewayModule } from './payment-gateway/payment-gateway.module';
import { PaymentModule } from './payment/payment.module';
import { QueueModule } from './queue/queue.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { WebhookModule } from './webhook/webhook.module';

/** ----- Register app feature modules in one place. ----- **/
export const FEATURE_MODULES = [
  LocksModule,
  InventoryModule,
  QueueModule,
  PaymentModule,
  PaymentGatewayModule,
  OrderModule,
  WebhookModule,
  ReconciliationModule,
];
