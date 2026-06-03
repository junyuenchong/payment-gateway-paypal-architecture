import type {
  CaptureCheckoutOrderResultDto,
  CreateCheckoutOrderResultDto,
} from '../../../modules/payment/dto/payment.dto';

export type GatewayCheckoutOrderStatusResultDto = { status: string };
export type { CreateCheckoutOrderResultDto, CaptureCheckoutOrderResultDto };
