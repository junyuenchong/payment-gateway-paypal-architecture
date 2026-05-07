export class CapturePaymentCommand {
  /**
   * ------------------------------------------------------
   * Capture Payment Command Payload
   * ------------------------------------------------------
   */
  constructor(public readonly orderId: string) {}
}

export type CapturePaymentResult = {
  orderId: string;
  status: import('../../order-status').OrderStatusCode;
  paypalOrderId: string;
  message: string;
};
