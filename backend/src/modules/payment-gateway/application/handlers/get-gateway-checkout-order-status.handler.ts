import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { PaymentGatewayService } from '../../payment-gateway.service';
import { GetGatewayCheckoutOrderStatusCommand } from '../commands/payment-gateway.command';

/** ----- Handle get gateway checkout order status command. ----- **/
@CommandHandler(GetGatewayCheckoutOrderStatusCommand)
export class GetGatewayCheckoutOrderStatusHandler implements ICommandHandler<
  GetGatewayCheckoutOrderStatusCommand,
  { status: string }
> {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly gateway: PaymentGatewayService) {}

  async execute(
    command: GetGatewayCheckoutOrderStatusCommand,
  ): Promise<{ status: string }> {
    return this.gateway.getCheckoutOrderStatus(command.paypalOrderId);
  }
}
