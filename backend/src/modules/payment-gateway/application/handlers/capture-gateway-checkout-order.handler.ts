import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { PaymentGatewayService } from '../../payment-gateway.service';
import {
  CaptureGatewayCheckoutOrderCommand,
  type CaptureGatewayCheckoutOrderResult,
} from '../commands/payment-gateway.command';

/** ----- Handle capture gateway checkout order command. ----- **/
@CommandHandler(CaptureGatewayCheckoutOrderCommand)
export class CaptureGatewayCheckoutOrderHandler implements ICommandHandler<
  CaptureGatewayCheckoutOrderCommand,
  CaptureGatewayCheckoutOrderResult
> {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly gateway: PaymentGatewayService) {}

  async execute(
    command: CaptureGatewayCheckoutOrderCommand,
  ): Promise<CaptureGatewayCheckoutOrderResult> {
    return this.gateway.captureCheckoutOrder(command.paypalOrderId);
  }
}
