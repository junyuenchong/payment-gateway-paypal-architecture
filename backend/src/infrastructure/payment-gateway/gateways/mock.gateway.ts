import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomUUID } from 'crypto';

import { AppConfigService } from '../../../common/config';
import { logErrorAndThrow } from '../../../common/shared/helpers/error.util';
import type { CreateCheckoutOrderInput } from '../../../modules/payment/dto/payment.input';
import type { PaymentGatewayPort } from '../contracts/payment-gateway.port';
import type {
  CaptureCheckoutOrderResultDto,
  CreateCheckoutOrderResultDto,
  GatewayCheckoutOrderStatusResultDto,
} from '../dto/payment-gateway.dto';

/** ----- Local mock payment gateway (no real PayPal UI). ----- **/
@Injectable()
export class MockPaymentGateway implements PaymentGatewayPort {
  private readonly logger = new Logger(MockPaymentGateway.name);

  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly cfg: AppConfigService) {}

  /** ----- Create a fake gateway checkout order id. ----- **/
  createCheckoutOrder(
    input: CreateCheckoutOrderInput,
  ): Promise<CreateCheckoutOrderResultDto> {
    const paypalOrderId = `MOCK-ORDER-${randomUUID()}`;
    const approvalUrl = `${this.cfg.app.frontendBaseUrl}/mock/complete?orderId=${input.internalOrderId}`;
    return Promise.resolve({ paypalOrderId, approvalUrl });
  }

  /** ----- Mock capture always succeeds for MOCK-ORDER ids. ----- **/
  captureCheckoutOrder(
    paypalOrderId: string,
  ): Promise<CaptureCheckoutOrderResultDto> {
    return Promise.resolve({
      success: String(paypalOrderId).startsWith('MOCK-ORDER-'),
    });
  }

  /** ----- Mock status for reconciliation sweeps. ----- **/
  getCheckoutOrderStatus(
    paypalOrderId: string,
  ): Promise<GatewayCheckoutOrderStatusResultDto> {
    if (String(paypalOrderId).startsWith('MOCK-ORDER-')) {
      return Promise.resolve({ status: 'COMPLETED' });
    }
    return Promise.resolve({ status: 'UNKNOWN' });
  }

  /** ----- POST a signed mock success webhook to this app. ----- **/
  deliverMockCaptureSuccess(params: {
    internalOrderId: string;
    paypalOrderId: string;
  }): Promise<void> {
    return this.deliverMockWebhookSuccess(params).catch((error: unknown) =>
      logErrorAndThrow(
        this.logger,
        error,
        'Deliver mock capture failed',
        `Mock deliverMockCaptureSuccess failed: ${params.internalOrderId}`,
      ),
    );
  }

  /** ----- Deliver mock webhook success event. ----- **/
  private async deliverMockWebhookSuccess(params: {
    internalOrderId: string;
    paypalOrderId: string;
  }): Promise<void> {
    const eventType = 'MOCK.PAYMENT.SUCCEEDED';
    const base = this.cfg.app.baseUrl;
    const secret = this.cfg.mock.webhookSecret;
    const eventId = `mock-${randomUUID()}`;
    const payload = {
      id: eventId,
      event_type: eventType,
      resource: {
        custom_id: params.internalOrderId,
        order_id: params.paypalOrderId,
        status: 'COMPLETED',
      },
    };

    const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
    const signature = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    const url = `${base.replace(/\/$/, '')}/webhooks/paypal`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-mock-signature': signature,
      },
      body: rawBody,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Mock webhook POST failed: HTTP ${response.status} ${text}`,
      );
    }
  }
}
