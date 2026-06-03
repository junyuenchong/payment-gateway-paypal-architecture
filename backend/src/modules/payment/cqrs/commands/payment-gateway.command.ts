/** ----- Handle payment gateway.command ----- **/
import type {
  CaptureCheckoutOrderResultDto,
  CreateCheckoutOrderResultDto,
} from '../../dto/payment.dto';
import type { CreateCheckoutOrderInput } from '../../dto/payment.input';

/** ----- Handle creat heckou rde ommand class ----- **/
export class CreateCheckoutOrderCommand {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(public readonly input: CreateCheckoutOrderInput) {}
}

/** ----- Handle captur heckou rde ommand class ----- **/
export class CaptureCheckoutOrderCommand {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(public readonly paypalOrderId: string) {}
}

export type CreateCheckoutOrderResult = CreateCheckoutOrderResultDto;
export type CaptureCheckoutOrderResult = CaptureCheckoutOrderResultDto;
