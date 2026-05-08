/** ----- Handle payment gateway.command ----- **/
import type {
  CaptureCheckoutOrderResultDto,
  CreateCheckoutOrderResultDto,
} from '../../payment-gateway.dto';
import type { CreateCheckoutOrderInput } from '../../../payment/dto/payment.input';

/** ----- Handle creat atewa heckou rde ommand class ----- **/
export class CreateGatewayCheckoutOrderCommand {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(public readonly input: CreateCheckoutOrderInput) {}
}

/** ----- Handle captur atewa heckou rde ommand class ----- **/
export class CaptureGatewayCheckoutOrderCommand {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(public readonly paypalOrderId: string) {}
}

/** ----- Handle ge atewa heckou rde tatu ommand class ----- **/
export class GetGatewayCheckoutOrderStatusCommand {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(public readonly paypalOrderId: string) {}
}

export type CreateGatewayCheckoutOrderResult = CreateCheckoutOrderResultDto;
export type CaptureGatewayCheckoutOrderResult = CaptureCheckoutOrderResultDto;
