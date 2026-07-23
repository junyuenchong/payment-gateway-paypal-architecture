import { Inject, Injectable } from '@nestjs/common';

import type { CreateCheckoutOrderInput } from '../../modules/payment/dto/payment.input';
import {
  PAYMENT_GATEWAY_PORT,
  type PaymentGatewayPort,
} from './contracts/payment-gateway.port';
import type {
  CaptureCheckoutOrderResultDto,
  CreateCheckoutOrderResultDto,
  GatewayCheckoutOrderStatusResultDto,
} from './dto/payment-gateway.dto';

/** ----- Facade over active PaymentGatewayPort (PayPal or Mock). ----- **/
@Injectable()
export class PaymentGatewayService implements PaymentGatewayPort {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(
    @Inject(PAYMENT_GATEWAY_PORT)
    private readonly gateway: PaymentGatewayPort,
  ) {}

  /** ----- Create gateway checkout order. ----- **/
  createCheckoutOrder(
    input: CreateCheckoutOrderInput,
  ): Promise<CreateCheckoutOrderResultDto> {
    return this.gateway.createCheckoutOrder(input);
  }

  /** ----- Capture gateway checkout order. ----- **/
  captureCheckoutOrder(
    paypalOrderId: string,
  ): Promise<CaptureCheckoutOrderResultDto> {
    return this.gateway.captureCheckoutOrder(paypalOrderId);
  }

  /** ----- Fetch gateway checkout order status. ----- **/
  getCheckoutOrderStatus(
    paypalOrderId: string,
  ): Promise<GatewayCheckoutOrderStatusResultDto> {
    return this.gateway.getCheckoutOrderStatus(paypalOrderId);
  }

  /** ----- Deliver mock capture success webhook. ----- **/
  deliverMockCaptureSuccess(params: {
    internalOrderId: string;
    paypalOrderId: string;
  }): Promise<void> {
    return this.gateway.deliverMockCaptureSuccess(params);
  }
}
