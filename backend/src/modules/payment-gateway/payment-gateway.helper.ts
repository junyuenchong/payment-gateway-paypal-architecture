import { HttpService } from '@nestjs/axios';
import { BadGatewayException, BadRequestException } from '@nestjs/common';
import type { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

import type { AppConfiguration } from '../../config';

/** ----- Get PayPal access token. ----- **/
export async function getPayPalAccessToken(
  http: HttpService,
  paypal: AppConfiguration['paypal'],
): Promise<string> {
  const auth = Buffer.from(`${paypal.clientId}:${paypal.secretKey}`).toString(
    'base64',
  );

  const { data } = await firstValueFrom(
    http.post<{ access_token: string }>(
      `${paypal.apiBase}/v1/oauth2/token`,
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
