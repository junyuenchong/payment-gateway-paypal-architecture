import { Global, Module } from '@nestjs/common';

import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationRepository } from './reconciliation.repository';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationSchedulerService } from './reconciliation.scheduler';

/** ----- Configure reconciliation module. ----- **/
@Global()
@Module({
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
