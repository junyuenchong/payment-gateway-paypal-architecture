import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, randomUUID } from 'crypto';
import { firstValueFrom } from 'rxjs';

import { AppConfigService } from '../../config';
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
    private readonly cfg: AppConfigService,
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
    const { apiBase } = this.cfg.paypal;
    const token = await getPayPalAccessToken(this.http, this.cfg.paypal);
    const frontendBaseUrl = this.cfg.app.frontendBaseUrl;
    // Construct PayPal return and cancel URLs
    const returnUrl = `${frontendBaseUrl}/paypal/complete?orderId=${params.internalOrderId}`;
    const cancelUrl = `${frontendBaseUrl}/paypal/cancelled?orderId=${params.internalOrderId}`;

    try {
      // Perform POST request to PayPal to create order
      const { data } = await firstValueFrom(
        this.http.post<{
          id: string;
          links?: Array<{ href: string; rel: string }>;
        }>(
          `${apiBase}/v2/checkout/orders`,
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

      // Log debug info for approval links in non-production
      if (!this.cfg.isProduction) {
        const linkRels = data.links?.map((link) => link.rel) ?? [];
        this.logger.debug(
          `PayPal order ${data.id} links rels: ${linkRels.join(', ')}`,
        );
      }

      // Extract approval URL from returned PayPal links
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
      // Handle PayPal and service errors
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
    // Attempt to capture PayPal checkout order here
    const token = await getPayPalAccessToken(this.http, this.cfg.paypal);

    try {
      // Send capture POST request to PayPal API endpoint
      const { data } = await firstValueFrom(
        this.http.post<{ status?: string }>(
          `${this.cfg.paypal.apiBase}/v2/checkout/orders/${paypalOrderId}/capture`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      // Return success only if status completed from PayPal
      return { success: data.status === 'COMPLETED' };
    } catch (error) {
      // Convert and throw PayPal error as service exception
      throw toPayPalException(error);
    }
  }

  /** ----- Get checkout order status from gateway ----- **/
  private async getCheckoutOrderStatusInternal(
    paypalOrderId: string,
  ): Promise<GatewayCheckoutOrderStatusResultDto> {
    // Check if mock payment gateway is enabled in config
    const useMock = this.cfg.isMockPaymentGateway;
    if (useMock) {
      // If order id starts with MOCK-ORDER- return COMPLETED
      if (String(paypalOrderId).startsWith('MOCK-ORDER-')) {
        return { status: 'COMPLETED' };
      }
      // Return UNKNOWN for all other mock cases
      return { status: 'UNKNOWN' };
    }

    // Get PayPal API configuration and authorization token
    const token = await getPayPalAccessToken(this.http, this.cfg.paypal);

    try {
      // Fetch PayPal order status from gateway endpoint
      const { data } = await firstValueFrom(
        this.http.get<{ status?: string }>(
          `${this.cfg.paypal.apiBase}/v2/checkout/orders/${paypalOrderId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      // Return PayPal order status as string or UNKNOWN fallback
      return { status: String(data.status ?? 'UNKNOWN') };
    } catch (error) {
      // Convert and rethrow PayPal errors as service exception
      throw toPayPalException(error);
    }
  }

  /** ----- Deliver mock webhook success event ----- **/
  private async deliverMockWebhookSuccess(params: {
    internalOrderId: string;
    paypalOrderId: string;
  }): Promise<void> {
    // Send mock payment succeeded event to webhook endpoint
    const eventType = 'MOCK.PAYMENT.SUCCEEDED';
    const base = this.cfg.app.baseUrl;
    const secret = this.cfg.mock.webhookSecret;

    // Generate unique mock event id and prepare payload object
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

    // Serialize payload and create signature for verification
    const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
    const signature = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    const url = `${base.replace(/\/$/, '')}/webhooks/paypal`;

    // Send POST to PayPal webhook endpoint with mock payload
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-mock-signature': signature,
      },
      body: rawBody,
    });

    // Throw error if webhook POST is not successful
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Mock webhook POST failed: HTTP ${response.status} ${text}`,
      );
    }
  }
}
