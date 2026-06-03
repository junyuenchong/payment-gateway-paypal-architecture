import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { OrderService } from '../../order.service';
import {
  CapturePaymentCommand,
  CapturePaymentResult,
} from '../commands/capture-payment.command';

/** ----- Handle captur aymen andler class ----- **/
@CommandHandler(CapturePaymentCommand)
export class CapturePaymentHandler implements ICommandHandler<
  CapturePaymentCommand,
  CapturePaymentResult
> {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly orders: OrderService) {}

  /** ----- Capture payment for order. ----- **/
  async execute(command: CapturePaymentCommand): Promise<CapturePaymentResult> {
    return this.orders.capturePayment(command.orderId);
  }
}
