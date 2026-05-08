/** ----- Handle create payment intent job.handler ----- **/
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

import { QueueRepository } from '../../queue.repository';
import { QueueService } from '../../queue.service';
import { CreatePaymentIntentJobCommand } from '../commands/queue-jobs.command';
import {
  CreateCheckoutOrderCommand,
  type CreateCheckoutOrderResult,
} from '../../../payment/application/commands/payment-gateway.command';

/** ----- Handle creat aymen nten o andler class ----- **/
@CommandHandler(CreatePaymentIntentJobCommand)
export class CreatePaymentIntentJobHandler implements ICommandHandler<CreatePaymentIntentJobCommand> {
  constructor(
    private readonly repository: QueueRepository,
    private readonly config: ConfigService,
    private readonly queue: QueueService,
    private readonly commandBus: CommandBus,
  ) {}

  /** ----- Handle execute method ----- **/
  async execute(command: CreatePaymentIntentJobCommand): Promise<void> {
    const orderId = command.data.orderId;
    const mockEnabled =
      this.config.get<string>('MOCK_PAYMENT_GATEWAY') === 'true';

    // Lock & snapshot. Never call external services in a transaction.
    const snapshot = await this.repository.lockOrderForPaymentIntent(
      orderId,
      mockEnabled,
    );

    if (!snapshot?.shouldWork) return;

    // Mock mode: create a fake gateway order id and schedule a signed mock webhook.
    if (mockEnabled) {
      const paypalOrderId = `MOCK-ORDER-${randomUUID()}`;

      await this.repository.saveMockGatewayOrder(orderId, paypalOrderId);

      await this.queue.scheduleMockCaptureSuccess({
        internalOrderId: orderId,
        paypalOrderId,
      });
      return;
    }

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

    // Persist gateway result under lock (idempotent).
    await this.repository.saveGatewayOrderResult({
      orderId,
      paypalOrderId,
      approvalUrl,
    });
  }
}
