/** ----- Handle captur aymen ommand class ----- **/
export class CapturePaymentCommand {
  /** ----- Capture Payment Command Payload ----- **/
  constructor(public readonly orderId: string) {}
}

export type CapturePaymentResult = {
  orderId: string;
  status: import('../../enums/order-status.enum').OrderStatusCode;
  paypalOrderId: string;
  message: string;
};
