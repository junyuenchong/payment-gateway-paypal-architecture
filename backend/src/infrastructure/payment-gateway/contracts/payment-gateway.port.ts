import type {
  CaptureCheckoutOrderResultDto,
  CreateCheckoutOrderResultDto,
} from '../../../modules/payment/dto/payment.dto';
import type { CreateCheckoutOrderInput } from '../../../modules/payment/dto/payment.input';

export type GatewayCheckoutOrderStatusResultDto = { status: string };

/** ----- Port every payment provider must implement. ----- **/
export interface PaymentGatewayPort {
  createCheckoutOrder(
    input: CreateCheckoutOrderInput,
  ): Promise<CreateCheckoutOrderResultDto>;

  captureCheckoutOrder(
    gatewayOrderId: string,
  ): Promise<CaptureCheckoutOrderResultDto>;

  getCheckoutOrderStatus(
    gatewayOrderId: string,
  ): Promise<GatewayCheckoutOrderStatusResultDto>;

  deliverMockCaptureSuccess(params: {
    internalOrderId: string;
    paypalOrderId: string;
  }): Promise<void>;
}

export const PAYMENT_GATEWAY_PORT = Symbol('PAYMENT_GATEWAY_PORT');

export type { CaptureCheckoutOrderResultDto, CreateCheckoutOrderResultDto };
