import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';

import { toErrorMessage } from '../../../../common/shared/helpers/error.util';
import { ReconciliationService } from '../../../reconciliation/reconciliation.service';
import { ReconcileOrdersSweepJobCommand } from '../commands/queue-jobs.command';

/** ----- Run reconciliation sweep job. ----- **/
@CommandHandler(ReconcileOrdersSweepJobCommand)
export class ReconcileOrdersSweepJobHandler implements ICommandHandler<ReconcileOrdersSweepJobCommand> {
  private readonly log = new Logger(ReconcileOrdersSweepJobHandler.name);

  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly reconciliation: ReconciliationService) {}

  /** ----- Execute reconciliation sweep. ----- **/
  async execute(command: ReconcileOrdersSweepJobCommand): Promise<void> {
    void command;
    try {
      await this.reconciliation.reconcileOrdersSweep();
    } catch (e) {
      const msg = toErrorMessage(e, 'Reconciliation sweep failed');
      this.log.error(`Reconciliation sweep failed: ${msg}`);
      throw e;
    }
  }
}
