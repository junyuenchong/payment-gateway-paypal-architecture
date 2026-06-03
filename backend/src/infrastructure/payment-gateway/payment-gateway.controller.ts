import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import type { CreateCheckoutOrderInput } from '../../modules/payment/dto/payment.input';
import type {
  CaptureCheckoutOrderResultDto,
  CreateCheckoutOrderResultDto,
  GatewayCheckoutOrderStatusResultDto,
} from './dto/payment-gateway.dto';
import { PaymentGatewayService } from './payment-gateway.service';

/** ----- Handle payment gateway endpoints. ----- **/
@Controller('payment-gateway')
export class PaymentGatewayController {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly gateway: PaymentGatewayService) {}

  /** ----- Create checkout order. ----- **/
  @Post('checkout')
  createCheckoutOrder(
    @Body() body: CreateCheckoutOrderInput,
  ): Promise<CreateCheckoutOrderResultDto> {
    return this.gateway.createCheckoutOrder(body);
  }

  /** ----- Capture checkout order. ----- **/
  @Post('checkout/:paypalOrderId/capture')
  captureCheckoutOrder(
    @Param('paypalOrderId') paypalOrderId: string,
  ): Promise<CaptureCheckoutOrderResultDto> {
    return this.gateway.captureCheckoutOrder(paypalOrderId);
  }

  /** ----- Get checkout order status. ----- **/
  @Get('checkout/:paypalOrderId/status')
  getCheckoutOrderStatus(
    @Param('paypalOrderId') paypalOrderId: string,
  ): Promise<GatewayCheckoutOrderStatusResultDto> {
    return this.gateway.getCheckoutOrderStatus(paypalOrderId);
  }
}
