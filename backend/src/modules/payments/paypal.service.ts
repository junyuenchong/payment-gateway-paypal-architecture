import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

import type {
  CaptureCheckoutOrderResultDto,
  CreateCheckoutOrderResultDto,
} from './dto/payment.dto';
import type { CreateCheckoutOrderInput } from './dto/payment.input';

@Injectable()
export class PayPalService {
  private readonly logger = new Logger(PayPalService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  /**
   * ------------------------------------------------------
   * Get PayPal OAuth Access Token
   * ------------------------------------------------------
   */
  private async getAccessToken(): Promise<string> {
    const id = this.config.getOrThrow<string>('PAYPAL_CLIENT_ID');
    const secret = this.config.getOrThrow<string>('PAYPAL_SECRET_KEY');
    const base = this.config.getOrThrow<string>('PAYPAL_API_BASE');
    const auth = Buffer.from(`${id}:${secret}`).toString('base64');

    const { data } = await firstValueFrom(
      this.http.post<{ access_token: string }>(
        `${base}/v1/oauth2/token`,
        new URLSearchParams({ grant_type: 'client_credentials' }),
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      ),
    );
    return data.access_token;
  }

  private extractPayPalErrorMessage(error: unknown): string {
    const axiosError = error as AxiosError<{
      message?: string;
      details?: Array<{ description?: string; issue?: string }>;
      name?: string;
    }>;
    const detail = axiosError.response?.data?.details?.[0];
    const detailMessage = detail?.description ?? detail?.issue;
    const rootMessage =
      detailMessage ??
      axiosError.response?.data?.message ??
      axiosError.response?.data?.name;
    return rootMessage ?? 'PayPal request failed';
  }

  private toPayPalException(
    error: unknown,
  ): BadRequestException | BadGatewayException {
    const status = (error as AxiosError).response?.status;
    const message = this.extractPayPalErrorMessage(error);
    if (status && status >= 400 && status < 500) {
      return new BadRequestException(`PayPal rejected request: ${message}`);
    }
    return new BadGatewayException(message);
  }

  /**
   * ------------------------------------------------------
   * Create PayPal Checkout Order
   * ------------------------------------------------------
   */
  async createCheckoutOrder(
    params: CreateCheckoutOrderInput,
  ): Promise<CreateCheckoutOrderResultDto> {
    const base = this.config.getOrThrow<string>('PAYPAL_API_BASE');
    const token = await this.getAccessToken();
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
      throw this.toPayPalException(error);
    }
  }

  /**
   * ------------------------------------------------------
   * Capture PayPal Checkout Order
   * ------------------------------------------------------
   */
  async captureCheckoutOrder(
    paypalOrderId: string,
  ): Promise<CaptureCheckoutOrderResultDto> {
    const base = this.config.getOrThrow<string>('PAYPAL_API_BASE');
    const token = await this.getAccessToken();

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
      throw this.toPayPalException(error);
    }
  }
}
