/** ----- Handle create payment intent job.handler ----- **/
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AppConfigService } from '../../../../common/config';
import { QueueService } from '../../queue.service';
import { CreatePaymentIntentJobCommand } from '../commands/queue-jobs.command';
import {
  CreateCheckoutOrderCommand,
  type CreateCheckoutOrderResult,
} from '../../../../modules/payment/cqrs/commands/payment-gateway.command';

/** ----- Handle create payment intent job. ----- **/
@CommandHandler(CreatePaymentIntentJobCommand)
export class CreatePaymentIntentJobHandler implements ICommandHandler<CreatePaymentIntentJobCommand> {
  constructor(
    private readonly queue: QueueService,
    private readonly cfg: AppConfigService,
    private readonly commandBus: CommandBus,
  ) {}

  /** ----- Handle execute method ----- **/
  async execute(command: CreatePaymentIntentJobCommand): Promise<void> {
    const orderId = command.data.orderId;
    const mockEnabled = this.cfg.isMockPaymentGateway;

    // Lock & snapshot. Never call external services in a transaction.
    const snapshot = await this.queue.lockOrderForPaymentIntent(
      orderId,
      mockEnabled,
    );

    if (!snapshot?.shouldWork) return;

    const amountStr = Number(snapshot.amount).toFixed(2);
    const currency = snapshot.currency.toUpperCase();

    const { paypalOrderId, approvalUrl } = await this.commandBus.execute<
      CreateCheckoutOrderCommand,
      CreateCheckoutOrderResult
    >(
      new CreateCheckoutOrderCommand({
        internalOrderId: orderId,
        amount: amountStr,
        currency,
      }),
    );

    if (mockEnabled) {
      await this.queue.saveMockGatewayOrder(orderId, paypalOrderId);
      await this.queue.scheduleMockCaptureSuccess({
        internalOrderId: orderId,
        paypalOrderId,
      });
      return;
    }

    await this.queue.saveGatewayOrderResult({
      orderId,
      paypalOrderId,
      approvalUrl: approvalUrl ?? '',
    });
  }
}
