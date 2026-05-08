/** ----- Handle schedule capture payment.handler ----- **/
import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { OrderService } from '../../order.service';
import { ScheduleCapturePaymentCommand } from '../commands/schedule-capture-payment.command';
import type { CapturePaymentResult } from '../commands/capture-payment.command';

/** ----- Handle schedul aptur aymen andler class ----- **/
@Injectable()
@CommandHandler(ScheduleCapturePaymentCommand)
export class ScheduleCapturePaymentHandler implements ICommandHandler<
  ScheduleCapturePaymentCommand,
  CapturePaymentResult
> {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly orders: OrderService) {}

  async execute(
    command: ScheduleCapturePaymentCommand,
  ): Promise<CapturePaymentResult> {
    return this.orders.scheduleCapturePayment(command.orderId);
  }
}
