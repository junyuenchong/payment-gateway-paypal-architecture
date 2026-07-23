import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

import { AppConfigService } from '../../../common/config';
import { logErrorAndThrow } from '../../../common/shared/helpers/error.util';
import type { CreateCheckoutOrderInput } from '../../../modules/payment/dto/payment.input';
import type { PaymentGatewayPort } from '../contracts/payment-gateway.port';
import type {
  CaptureCheckoutOrderResultDto,
  CreateCheckoutOrderResultDto,
  GatewayCheckoutOrderStatusResultDto,
} from '../dto/payment-gateway.dto';
import {
  getPayPalAccessToken,
  toPayPalException,
} from '../helpers/payment-gateway.helper';

/** ----- PayPal Checkout API adapter. ----- **/
@Injectable()
export class PaypalPaymentGateway implements PaymentGatewayPort {
  private readonly logger = new Logger(PaypalPaymentGateway.name);

  /** ----- Handle constructor dependency wiring ----- **/
  constructor(
    private readonly http: HttpService,
    private readonly cfg: AppConfigService,
  ) {}

  /** ----- Create PayPal checkout order. ----- **/
  createCheckoutOrder(
    input: CreateCheckoutOrderInput,
  ): Promise<CreateCheckoutOrderResultDto> {
    return this.createCheckoutOrderInternal(input).catch((error: unknown) =>
      logErrorAndThrow(
        this.logger,
        error,
        'Create checkout order failed',
        'PayPal createCheckoutOrder failed',
      ),
    );
  }

  /** ----- Capture PayPal checkout order. ----- **/
  captureCheckoutOrder(
    paypalOrderId: string,
  ): Promise<CaptureCheckoutOrderResultDto> {
    return this.captureCheckoutOrderInternal(paypalOrderId).catch(
      (error: unknown) =>
        logErrorAndThrow(
          this.logger,
          error,
          'Capture checkout order failed',
          `PayPal captureCheckoutOrder failed: ${paypalOrderId}`,
        ),
    );
  }

  /** ----- Fetch PayPal checkout order status. ----- **/
  getCheckoutOrderStatus(
    paypalOrderId: string,
  ): Promise<GatewayCheckoutOrderStatusResultDto> {
    return this.getCheckoutOrderStatusInternal(paypalOrderId).catch(
      (error: unknown) =>
        logErrorAndThrow(
          this.logger,
          error,
          'Get checkout order status failed',
          `PayPal getCheckoutOrderStatus failed: ${paypalOrderId}`,
        ),
    );
  }

  /** ----- Mock capture is not supported on live PayPal gateway. ----- **/
  deliverMockCaptureSuccess(): Promise<void> {
    return Promise.reject(
      new ServiceUnavailableException(
        'Mock capture is only available when MOCK_PAYMENT_GATEWAY=true',
      ),
    );
  }

  /** ----- Create checkout order via PayPal API. ----- **/
  private async createCheckoutOrderInternal(
    params: CreateCheckoutOrderInput,
  ): Promise<CreateCheckoutOrderResultDto> {
    const { apiBase } = this.cfg.paypal;
    const token = await getPayPalAccessToken(this.http, this.cfg.paypal);
    const frontendBaseUrl = this.cfg.app.frontendBaseUrl;
    const returnUrl = `${frontendBaseUrl}/paypal/complete?orderId=${params.internalOrderId}`;
    const cancelUrl = `${frontendBaseUrl}/paypal/cancelled?orderId=${params.internalOrderId}`;

    try {
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
            application_context: {
              return_url: returnUrl,
              cancel_url: cancelUrl,
              user_action: 'PAY_NOW',
              shipping_preference: 'NO_SHIPPING',
              landing_page: 'LOGIN',
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

      if (!this.cfg.isProduction) {
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

  /** ----- Capture checkout order via PayPal API. ----- **/
  private async captureCheckoutOrderInternal(
    paypalOrderId: string,
  ): Promise<CaptureCheckoutOrderResultDto> {
    const token = await getPayPalAccessToken(this.http, this.cfg.paypal);

    try {
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

      return { success: data.status === 'COMPLETED' };
    } catch (error) {
      throw toPayPalException(error);
    }
  }

  /** ----- Get checkout order status from PayPal. ----- **/
  private async getCheckoutOrderStatusInternal(
    paypalOrderId: string,
  ): Promise<GatewayCheckoutOrderStatusResultDto> {
    const token = await getPayPalAccessToken(this.http, this.cfg.paypal);

    try {
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

      return { status: String(data.status ?? 'UNKNOWN') };
    } catch (error) {
      throw toPayPalException(error);
    }
  }
}
