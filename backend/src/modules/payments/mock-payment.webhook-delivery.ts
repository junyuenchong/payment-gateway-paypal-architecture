import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'crypto';

/**
 * ------------------------------------------------------
 * Deliver Mock Payment Webhook
 * ------------------------------------------------------
 */
@Injectable()
export class MockPaymentWebhookDeliveryService {
  constructor(private readonly config: ConfigService) {}

  async deliverSuccess(params: {
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
