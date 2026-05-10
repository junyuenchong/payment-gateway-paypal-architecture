import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { PaymentModule } from '../payment/payment.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationRepository } from './reconciliation.repository';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationSchedulerService } from './reconciliation.scheduler';

/** ----- Configure reconciliation module. ----- **/
@Module({
  imports: [CqrsModule, PrismaModule, QueueModule, PaymentModule],
  controllers: [ReconciliationController],
  providers: [
    ReconciliationSchedulerService,
    ReconciliationService,
    ReconciliationRepository,
    ...EventHandlers,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
})
/** ----- Handle reconciliatio odule class ----- **/
export class ReconciliationModule {}
