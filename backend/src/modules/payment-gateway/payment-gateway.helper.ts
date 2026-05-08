import { HttpService } from '@nestjs/axios';
import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

/** ----- Get PayPal access token. ----- **/
export async function getPayPalAccessToken(
  http: HttpService,
  config: ConfigService,
): Promise<string> {
  const id = config.getOrThrow<string>('PAYPAL_CLIENT_ID');
  const secret = config.getOrThrow<string>('PAYPAL_SECRET_KEY');
  const base = config.getOrThrow<string>('PAYPAL_API_BASE');
  const auth = Buffer.from(`${id}:${secret}`).toString('base64');

  const { data } = await firstValueFrom(
    http.post<{ access_token: string }>(
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

/** ----- Convert PayPal error to HTTP exception. ----- **/
export function toPayPalException(
  error: unknown,
): BadRequestException | BadGatewayException {
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
  const message = rootMessage ?? 'PayPal request failed';
  const status = axiosError.response?.status;

  if (status && status >= 400 && status < 500) {
    return new BadRequestException(`PayPal rejected request: ${message}`);
  }
  return new BadGatewayException(message);
}
