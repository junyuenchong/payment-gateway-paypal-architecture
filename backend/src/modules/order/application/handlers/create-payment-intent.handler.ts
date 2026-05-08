import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { OrderService } from '../../order.service';
import {
  CreatePaymentIntentCommand,
  PaymentIntentResult,
} from '../commands/create-payment-intent.command';

/** ----- Handle creat aymen nten andler class ----- **/
@CommandHandler(CreatePaymentIntentCommand)
export class CreatePaymentIntentHandler implements ICommandHandler<
  CreatePaymentIntentCommand,
  PaymentIntentResult
> {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly orders: OrderService) {}

  /** ----- Create payment intent and enqueue checkout creation. ----- **/
  async execute(
    command: CreatePaymentIntentCommand,
  ): Promise<PaymentIntentResult> {
    return this.orders.createPaymentIntent(command.orderId);
  }
}
