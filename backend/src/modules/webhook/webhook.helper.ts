import { HttpService } from '@nestjs/axios';
import { BadRequestException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { firstValueFrom } from 'rxjs';

import type { AppConfigService } from '../../config';

/** ----- Verify webhook signature. ----- **/
export async function assertValidWebhookSignature(params: {
  cfg: AppConfigService;
  http: HttpService;
  rawBody: Buffer;
  mockSignatureHeader: string | undefined;
  paypalTransmissionId: string | undefined;
  paypalTransmissionTime: string | undefined;
  paypalTransmissionSig: string | undefined;
  paypalCertUrl: string | undefined;
  paypalAuthAlgo: string | undefined;
}): Promise<void> {
  if (params.cfg.isMockPaymentGateway) {
    const secret = params.cfg.mock.webhookSecret;
    const expected = `sha256=${createHmac('sha256', secret).update(params.rawBody).digest('hex')}`;
    const given = params.mockSignatureHeader ?? '';
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(given, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('Invalid mock webhook signature');
    }
    return;
  }

  const transmissionId = params.paypalTransmissionId ?? '';
  const transmissionTime = params.paypalTransmissionTime ?? '';
  const transmissionSig = params.paypalTransmissionSig ?? '';
  const certUrl = params.paypalCertUrl ?? '';
  const authAlgo = params.paypalAuthAlgo ?? '';
  if (
    !transmissionId ||
    !transmissionTime ||
    !transmissionSig ||
    !certUrl ||
    !authAlgo
  ) {
    throw new BadRequestException(
      'Missing required PayPal transmission signature headers',
    );
  }

  const webhookId = params.cfg.paypal.webhookId;
  if (!webhookId) {
    throw new BadRequestException('PAYPAL_WEBHOOK_ID is not configured');
  }

  const { clientId, secretKey, apiBase } = params.cfg.paypal;
  const auth = Buffer.from(`${clientId}:${secretKey}`).toString('base64');

  const tokenResponse = await firstValueFrom(
    params.http.post<{ access_token: string }>(
      `${apiBase}/v1/oauth2/token`,
      new URLSearchParams({ grant_type: 'client_credentials' }),
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    ),
  );
  const accessToken = tokenResponse.data.access_token;

  let webhookEvent: unknown;
  try {
    webhookEvent = JSON.parse(params.rawBody.toString('utf8'));
  } catch {
    throw new BadRequestException('Invalid JSON payload');
  }

  const verifyResponse = await firstValueFrom(
    params.http.post<{ verification_status?: string }>(
      `${apiBase}/v1/notifications/verify-webhook-signature`,
      {
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: webhookEvent,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    ),
  );

  if (verifyResponse.data.verification_status !== 'SUCCESS') {
    throw new BadRequestException('Invalid PayPal webhook signature');
  }
}
