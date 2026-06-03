/** ----- Handle capture checkout order.handler ----- **/
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { PaymentService } from '../../payment.service';
import {
  CaptureCheckoutOrderCommand,
  CaptureCheckoutOrderResult,
} from '../commands/payment-gateway.command';

/** ----- Handle captur heckou rde andler class ----- **/
@CommandHandler(CaptureCheckoutOrderCommand)
export class CaptureCheckoutOrderHandler implements ICommandHandler<
  CaptureCheckoutOrderCommand,
  CaptureCheckoutOrderResult
> {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly payment: PaymentService) {}

  async execute(
    command: CaptureCheckoutOrderCommand,
  ): Promise<CaptureCheckoutOrderResult> {
    return this.payment.captureCheckoutOrder(command.paypalOrderId);
  }
}
