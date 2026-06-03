import { Module, forwardRef } from '@nestjs/common';

import { InventoryModule } from '../../modules/inventory/inventory.module';
import { PaymentModule } from '../../modules/payment/payment.module';
import { QueueModule } from '../queue/queue.module';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationService } from './reconciliation.service';

/** ----- Configure reconciliation module. ----- **/
@Module({
  imports: [
    forwardRef(() => InventoryModule),
    forwardRef(() => QueueModule),
    PaymentModule,
  ],
  controllers: [ReconciliationController],
  providers: [ReconciliationService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
