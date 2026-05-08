import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'crypto';
import { firstValueFrom } from 'rxjs';

import { logErrorAndThrow } from '../common/error.util';
import type { CreateCheckoutOrderInput } from '../payment/dto/payment.input';
import {
  getPayPalAccessToken,
  toPayPalException,
} from './payment-gateway.helper';
import type {
  CaptureCheckoutOrderResultDto,
  CreateCheckoutOrderResultDto,
  GatewayCheckoutOrderStatusResultDto,
} from './payment-gateway.dto';

/** ----- Handle payment gateway operations (PayPal + mock). ----- **/
@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);

  /** ----- Handle constructor dependency wiring ----- **/
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  /** ----- Create gateway checkout order. ----- **/
  createCheckoutOrder(
    input: CreateCheckoutOrderInput,
  ): Promise<CreateCheckoutOrderResultDto> {
    return this.createCheckoutOrderInternal(input).catch((error: unknown) => {
      return logErrorAndThrow(
        this.logger,
        error,
        'Create checkout order failed',
        'createCheckoutOrder failed',
      );
    });
  }

  /** ----- Capture gateway checkout order. ----- **/
  captureCheckoutOrder(
    paypalOrderId: string,
  ): Promise<CaptureCheckoutOrderResultDto> {
    return this.captureCheckoutOrderInternal(paypalOrderId).catch(
      (error: unknown) => {
        return logErrorAndThrow(
          this.logger,
          error,
          'Capture checkout order failed',
          `captureCheckoutOrder failed: ${paypalOrderId ?? 'undefined'}`,
        );
      },
    );
  }

  /** ----- Fetch gateway checkout order status. ----- **/
  getCheckoutOrderStatus(
    paypalOrderId: string,
  ): Promise<GatewayCheckoutOrderStatusResultDto> {
    return this.getCheckoutOrderStatusInternal(paypalOrderId).catch(
      (error: unknown) => {
        return logErrorAndThrow(
          this.logger,
          error,
          'Get checkout order status failed',
          `getCheckoutOrderStatus failed: ${paypalOrderId ?? 'undefined'}`,
        );
      },
    );
  }

  /** ----- Deliver mock capture success webhook. ----- **/
  deliverMockCaptureSuccess(params: {
    internalOrderId: string;
    paypalOrderId: string;
  }): Promise<void> {
    return this.deliverMockWebhookSuccess(params).catch((error: unknown) => {
      return logErrorAndThrow(
        this.logger,
        error,
        'Deliver mock capture failed',
        `deliverMockCaptureSuccess failed: ${params.internalOrderId ?? 'undefined'}`,
      );
    });
  }

  /** ----- Create checkout order via PayPal API ----- **/
  private async createCheckoutOrderInternal(
    params: CreateCheckoutOrderInput,
  ): Promise<CreateCheckoutOrderResultDto> {
    const base = this.config.getOrThrow<string>('PAYPAL_API_BASE');
    const token = await getPayPalAccessToken(this.http, this.config);
    const frontendBaseUrl =
      this.config.get<string>('FRONTEND_BASE_URL') ?? 'http://localhost:8080';
    const returnUrl = `${frontendBaseUrl}/paypal/complete?orderId=${params.internalOrderId}`;
    const cancelUrl = `${frontendBaseUrl}/paypal/cancelled?orderId=${params.internalOrderId}`;

    try {
      const { data } = await firstValueFrom(
        this.http.post<{
          id: string;
          links?: Array<{ href: string; rel: string }>;
        }>(
          `${base}/v2/checkout/orders`,
          {
            intent: 'CAPTURE',
            purchase_units: [
              {
                custom_id: params.internalOrderId,
                amount: {
                  currency_code: params.currency,
                  value: params.amount,
                },
              },
            ],
            payment_source: {
              paypal: {
                experience_context: {
                  user_action: 'PAY_NOW',
                  return_url: returnUrl,
                  cancel_url: cancelUrl,
                },
              },
            },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation',
            },
          },
        ),
      );

      if (this.config.get<string>('NODE_ENV') !== 'production') {
        const linkRels = data.links?.map((link) => link.rel) ?? [];
        this.logger.debug(
          `PayPal order ${data.id} links rels: ${linkRels.join(', ')}`,
        );
      }

      const approvalUrl =
        data.links?.find((l) => l.rel === 'approve')?.href ??
        data.links?.find((l) => l.rel === 'payer-action')?.href;
      if (!approvalUrl) {
        throw new ServiceUnavailableException(
          'PayPal order missing approve link',
        );
      }
      return { paypalOrderId: data.id, approvalUrl };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw toPayPalException(error);
    }
  }

  /** ----- Capture checkout order via PayPal API ----- **/
  private async captureCheckoutOrderInternal(
    paypalOrderId: string,
  ): Promise<CaptureCheckoutOrderResultDto> {
    const base = this.config.getOrThrow<string>('PAYPAL_API_BASE');
    const token = await getPayPalAccessToken(this.http, this.config);

    try {
      const { data } = await firstValueFrom(
        this.http.post<{ status?: string }>(
          `${base}/v2/checkout/orders/${paypalOrderId}/capture`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return { success: data.status === 'COMPLETED' };
    } catch (error) {
      throw toPayPalException(error);
    }
  }

  /** ----- Get checkout order status from gateway ----- **/
  private async getCheckoutOrderStatusInternal(
    paypalOrderId: string,
  ): Promise<GatewayCheckoutOrderStatusResultDto> {
    const useMock = this.config.get<string>('MOCK_PAYMENT_GATEWAY') === 'true';
    if (useMock) {
      if (String(paypalOrderId).startsWith('MOCK-ORDER-')) {
        return { status: 'COMPLETED' };
      }
      return { status: 'UNKNOWN' };
    }

    const base = this.config.getOrThrow<string>('PAYPAL_API_BASE');
    const token = await getPayPalAccessToken(this.http, this.config);

    try {
      const { data } = await firstValueFrom(
        this.http.get<{ status?: string }>(
          `${base}/v2/checkout/orders/${paypalOrderId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return { status: String(data.status ?? 'UNKNOWN') };
    } catch (error) {
      throw toPayPalException(error);
    }
  }

  /** ----- Deliver mock webhook success event ----- **/
  private async deliverMockWebhookSuccess(params: {
    internalOrderId: string;
    paypalOrderId: string;
  }): Promise<void> {
    const eventType = 'MOCK.PAYMENT.SUCCEEDED';
    const base = this.config.getOrThrow<string>('APP_BASE_URL');
    const secret = this.config.getOrThrow<string>('MOCK_WEBHOOK_SECRET');

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
