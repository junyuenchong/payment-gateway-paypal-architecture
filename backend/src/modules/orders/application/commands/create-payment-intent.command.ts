export class CreatePaymentIntentCommand {
  /**
   * ------------------------------------------------------
   * Create Payment Intent Command Payload
   * ------------------------------------------------------
   */
  constructor(public readonly orderId: string) {}
}

export type PaymentIntentResult = {
  provider: 'PAYPAL' | 'MOCK';
  orderId: string;
  status: string;
  mock: boolean;
  internalOrderId: string;
  paypalOrderId: string | null;
  approvalUrl: string | null;
  message: string;
};
