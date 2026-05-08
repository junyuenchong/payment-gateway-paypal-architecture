/** ----- Handle create checkout order.handler ----- **/
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { PaymentService } from '../../payment.service';
import {
  CreateCheckoutOrderCommand,
  CreateCheckoutOrderResult,
} from '../commands/payment-gateway.command';

/** ----- Handle creat heckou rde andler class ----- **/
@CommandHandler(CreateCheckoutOrderCommand)
export class CreateCheckoutOrderHandler implements ICommandHandler<
  CreateCheckoutOrderCommand,
  CreateCheckoutOrderResult
> {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly payment: PaymentService) {}

  async execute(
    command: CreateCheckoutOrderCommand,
  ): Promise<CreateCheckoutOrderResult> {
    return this.payment.createCheckoutOrder(command.input);
  }
}
