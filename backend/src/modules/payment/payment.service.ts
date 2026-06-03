import { Injectable } from '@nestjs/common';

import type {
  CaptureCheckoutOrderResultDto,
  CreateCheckoutOrderResultDto,
} from './dto/payment.dto';
import type { CreateCheckoutOrderInput } from './dto/payment.input';
import { PaymentGatewayService } from '../../infrastructure/payment-gateway/payment-gateway.service';

/** ----- Handle payment operations. ----- **/
@Injectable()
export class PaymentService {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly gateway: PaymentGatewayService) {}

  /** ----- Create checkout order via gateway. ----- **/
  createCheckoutOrder(
    input: CreateCheckoutOrderInput,
  ): Promise<CreateCheckoutOrderResultDto> {
    return this.gateway.createCheckoutOrder(input);
  }

  /** ----- Capture checkout order via gateway. ----- **/
  captureCheckoutOrder(
    paypalOrderId: string,
  ): Promise<CaptureCheckoutOrderResultDto> {
    return this.gateway.captureCheckoutOrder(paypalOrderId);
  }

  /** ----- Fetch checkout order status. ----- **/
  getCheckoutOrderStatus(paypalOrderId: string): Promise<{ status: string }> {
    return this.gateway.getCheckoutOrderStatus(paypalOrderId);
  }

  /** ----- Deliver mock capture success event. ----- **/
  deliverMockCaptureSuccess(params: {
    internalOrderId: string;
    paypalOrderId: string;
  }): Promise<void> {
    return this.gateway.deliverMockCaptureSuccess(params);
  }
}
