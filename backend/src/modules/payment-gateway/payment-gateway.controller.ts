import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import type {
  CaptureCheckoutOrderResultDto,
  CreateCheckoutOrderResultDto,
  GatewayCheckoutOrderStatusResultDto,
} from './payment-gateway.dto';
import type { CreateCheckoutOrderInput } from '../payment/dto/payment.input';
import {
  CaptureGatewayCheckoutOrderCommand,
  CreateGatewayCheckoutOrderCommand,
  GetGatewayCheckoutOrderStatusCommand,
} from './application/commands/payment-gateway.command';

/** ----- Handle payment gateway endpoints. ----- **/
@Controller('payment-gateway')
export class PaymentGatewayController {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly commandBus: CommandBus) {}

  /** ----- Create checkout order. ----- **/
  @Post('checkout')
  createCheckoutOrder(
    @Body() body: CreateCheckoutOrderInput,
  ): Promise<CreateCheckoutOrderResultDto> {
    return this.commandBus.execute(new CreateGatewayCheckoutOrderCommand(body));
  }

  /** ----- Capture checkout order. ----- **/
  @Post('checkout/:paypalOrderId/capture')
  captureCheckoutOrder(
    @Param('paypalOrderId') paypalOrderId: string,
  ): Promise<CaptureCheckoutOrderResultDto> {
    return this.commandBus.execute(
      new CaptureGatewayCheckoutOrderCommand(paypalOrderId),
    );
  }

  /** ----- Get checkout order status. ----- **/
  @Get('checkout/:paypalOrderId/status')
  getCheckoutOrderStatus(
    @Param('paypalOrderId') paypalOrderId: string,
  ): Promise<GatewayCheckoutOrderStatusResultDto> {
    return this.commandBus.execute(
      new GetGatewayCheckoutOrderStatusCommand(paypalOrderId),
    );
  }
}
