import type {
  CaptureCheckoutOrderResultDto,
  CreateCheckoutOrderResultDto,
} from '../payment/dto/payment.dto';

export type GatewayCheckoutOrderStatusResultDto = { status: string };
export type { CreateCheckoutOrderResultDto, CaptureCheckoutOrderResultDto };
