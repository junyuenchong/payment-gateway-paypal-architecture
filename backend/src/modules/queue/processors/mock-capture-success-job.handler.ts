/** ----- Handle mock capture success job.handler ----- **/
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { PaymentService } from '../../payment/payment.service';
import { MockCaptureSuccessJobCommand } from '../application/commands/queue-jobs.command';

/** ----- Handle moc aptur ucces o andler class ----- **/
@CommandHandler(MockCaptureSuccessJobCommand)
export class MockCaptureSuccessJobHandler implements ICommandHandler<MockCaptureSuccessJobCommand> {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly payment: PaymentService) {}

  /** ----- Handle execute method ----- **/
  async execute(command: MockCaptureSuccessJobCommand): Promise<void> {
    await this.payment.deliverMockCaptureSuccess(command.data);
  }
}
