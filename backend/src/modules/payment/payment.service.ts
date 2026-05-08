import { Injectable } from '@nestjs/common';

import type {
  CaptureCheckoutOrderResultDto,
  CreateCheckoutOrderResultDto,
} from './dto/payment.dto';
import type { CreateCheckoutOrderInput } from './dto/payment.input';
import { PaymentGatewayService } from '../payment-gateway/payment-gateway.service';

/** ----- Handle payment operations. ----- **/
@Injectable()
export class PaymentService {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly gateway: PaymentGatewayService) {}

  /** Create a new checkout order via gateway service **/
  createCheckoutOrder(
    input: CreateCheckoutOrderInput,
  ): Promise<CreateCheckoutOrderResultDto> {
    return this.gateway.createCheckoutOrder(input);
  }

  /** Capture an existing checkout order from gateway **/
  captureCheckoutOrder(
    paypalOrderId: string,
  ): Promise<CaptureCheckoutOrderResultDto> {
    return this.gateway.captureCheckoutOrder(paypalOrderId);
  }

  /** ----- Fetch checkout order status. ----- **/
  getCheckoutOrderStatus(paypalOrderId: string): Promise<{ status: string }> {
    return this.gateway.getCheckoutOrderStatus(paypalOrderId);
  }

  /** Deliver mock PayPal capture success event via gateway service **/
  deliverMockCaptureSuccess(params: {
    internalOrderId: string;
    paypalOrderId: string;
  }): Promise<void> {
    return this.gateway.deliverMockCaptureSuccess(params);
  }
}
