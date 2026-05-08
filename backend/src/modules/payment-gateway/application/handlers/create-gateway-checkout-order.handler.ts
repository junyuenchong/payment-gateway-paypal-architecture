import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { PaymentGatewayService } from '../../payment-gateway.service';
import {
  CreateGatewayCheckoutOrderCommand,
  type CreateGatewayCheckoutOrderResult,
} from '../commands/payment-gateway.command';

/** ----- Handle create gateway checkout order command. ----- **/
@CommandHandler(CreateGatewayCheckoutOrderCommand)
export class CreateGatewayCheckoutOrderHandler implements ICommandHandler<
  CreateGatewayCheckoutOrderCommand,
  CreateGatewayCheckoutOrderResult
> {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly gateway: PaymentGatewayService) {}

  async execute(
    command: CreateGatewayCheckoutOrderCommand,
  ): Promise<CreateGatewayCheckoutOrderResult> {
    return this.gateway.createCheckoutOrder(command.input);
  }
}
