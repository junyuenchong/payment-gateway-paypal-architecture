/** ----- Handle reconcile orders sweep.handler ----- **/
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';

import { toErrorMessage } from '../../../../shared/helpers/error.util';
import { ReconcileOrdersSweepCommand } from '../commands/reconcile-orders-sweep.command';
import { ReconciliationService } from '../../reconciliation.service';

/** ----- Handle reconcil rder wee andler class ----- **/
@CommandHandler(ReconcileOrdersSweepCommand)
export class ReconcileOrdersSweepHandler implements ICommandHandler<ReconcileOrdersSweepCommand> {
  private readonly log = new Logger(ReconcileOrdersSweepHandler.name);

  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly reconciliation: ReconciliationService) {}

  /** ----- Handle execute method ----- **/
  async execute(command: ReconcileOrdersSweepCommand): Promise<void> {
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
