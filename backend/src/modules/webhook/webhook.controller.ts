import {
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import configuration from '../../common/config/configuration';
import type { ReceiveWebhookResponseDto } from './dto/webhook.dto';
import {
  ReceiveWebhookCommand,
  type ReceiveWebhookCommandResult,
} from './cqrs/commands/receive-webhook.command';
import { WEBHOOK_ROUTE } from './webhook.constant';

/** ----- Handle webhook controller class ----- **/
@Controller(WEBHOOK_ROUTE.PAYPAL)
@Throttle({
  default: {
    limit: () => configuration().rateLimit.webhookLimit,
    ttl: () => configuration().rateLimit.webhookTtlMs,
  },
})
export class WebhookController {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly commandBus: CommandBus) {}

  /** ----- Handle PayPal webhook request. ----- **/
  @Post()
  @HttpCode(200)
  async receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-mock-signature') mockSig: string | undefined,
    @Headers('paypal-transmission-id') transmissionId: string | undefined,
    @Headers('paypal-transmission-time') transmissionTime: string | undefined,
    @Headers('paypal-transmission-sig') transmissionSig: string | undefined,
    @Headers('paypal-cert-url') certUrl: string | undefined,
    @Headers('paypal-auth-algo') authAlgo: string | undefined,
  ) {
    const raw = await this.commandBus.execute<
      ReceiveWebhookCommand,
      ReceiveWebhookCommandResult
    >(
      new ReceiveWebhookCommand({
        rawBody: req.rawBody,
        headers: {
          mockSig,
          paypalTransmissionId: transmissionId,
          paypalTransmissionTime: transmissionTime,
          paypalTransmissionSig: transmissionSig,
          paypalCertUrl: certUrl,
          paypalAuthAlgo: authAlgo,
        },
      }),
    );
    return {
      ok: true,
      duplicate: raw.duplicate,
    } satisfies ReceiveWebhookResponseDto;
  }
}
