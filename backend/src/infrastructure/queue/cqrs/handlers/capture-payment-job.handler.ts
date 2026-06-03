/** ----- Handle capture payment job.handler ----- **/
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CapturePaymentCommand } from '../../../../modules/order/cqrs/commands/capture-payment.command';
import { CapturePaymentJobCommand } from '../commands/queue-jobs.command';

/** ----- Handle captur aymen o andler class ----- **/
@CommandHandler(CapturePaymentJobCommand)
export class CapturePaymentJobHandler implements ICommandHandler<CapturePaymentJobCommand> {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly commandBus: CommandBus) {}

  /** ----- Handle execute method ----- **/
  async execute(command: CapturePaymentJobCommand): Promise<void> {
    await this.commandBus.execute(
      new CapturePaymentCommand(command.data.orderId),
    );
  }
}
