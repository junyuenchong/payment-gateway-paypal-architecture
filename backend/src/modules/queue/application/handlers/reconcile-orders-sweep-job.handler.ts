/** ----- Handle reconcile orders sweep job.handler ----- **/
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { ReconcileOrdersSweepJobCommand } from '../commands/queue-jobs.command';
import { ReconcileOrdersSweepCommand } from '../../../reconciliation/application/commands/reconcile-orders-sweep.command';

/** ----- Handle reconcil rder wee o andler class ----- **/
@CommandHandler(ReconcileOrdersSweepJobCommand)
export class ReconcileOrdersSweepJobHandler implements ICommandHandler<ReconcileOrdersSweepJobCommand> {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly commandBus: CommandBus) {}

  /** ----- Handle execute method ----- **/
  async execute(command: ReconcileOrdersSweepJobCommand): Promise<void> {
    void command;
    await this.commandBus.execute(new ReconcileOrdersSweepCommand());
  }
}
