import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class WebhookSignatureService {
  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  /**
   * ------------------------------------------------------
   * Validate Incoming Webhook Signature
   * ------------------------------------------------------
   */
  async assertValid(params: {
    rawBody: Buffer | undefined;
    mockSignatureHeader: string | undefined;
    paypalTransmissionId: string | undefined;
    paypalTransmissionTime: string | undefined;
    paypalTransmissionSig: string | undefined;
    paypalCertUrl: string | undefined;
    paypalAuthAlgo: string | undefined;
  }): Promise<void> {
    const useMock = this.config.get<string>('MOCK_PAYMENT_GATEWAY') === 'true';
    const rawBody = params.rawBody;
    if (!rawBody?.length) {
      throw new BadRequestException('Missing raw webhook body');
    }

    if (useMock) {
      const secret = this.config.getOrThrow<string>('MOCK_WEBHOOK_SECRET');
      const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
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

    const webhookId = this.config.get<string>('PAYPAL_WEBHOOK_ID');
    if (!webhookId) {
      throw new BadRequestException('PAYPAL_WEBHOOK_ID is not configured');
    }

    const clientId = this.config.getOrThrow<string>('PAYPAL_CLIENT_ID');
    const secret = this.config.getOrThrow<string>('PAYPAL_SECRET_KEY');
    const base = this.config.getOrThrow<string>('PAYPAL_API_BASE');
    const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');

    const tokenResponse = await firstValueFrom(
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
    const accessToken = tokenResponse.data.access_token;

    let webhookEvent: unknown;
    try {
      webhookEvent = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid JSON payload');
    }

    const verifyResponse = await firstValueFrom(
      this.http.post<{ verification_status?: string }>(
        `${base}/v1/notifications/verify-webhook-signature`,
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
}
