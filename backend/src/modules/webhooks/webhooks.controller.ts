import {
  Controller,
  Headers,
  HttpCode,
  InternalServerErrorException,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { Request } from 'express';

import {
  ReceiveWebhookCommand,
  isReceiveWebhookResult,
} from './application/commands/receive-webhook.command';
import type { ReceiveWebhookResponseDto } from './dto/webhook.dto';
import { WebhookSignatureService } from './webhook-signature.service';

@Controller('webhooks/paypal')
export class WebhooksController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly signature: WebhookSignatureService,
  ) {}

  /**
   * ------------------------------------------------------
   * Receive PayPal Webhook
   * ------------------------------------------------------
   */
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
    await this.signature.assertValid({
      rawBody: req.rawBody,
      mockSignatureHeader: mockSig,
      paypalTransmissionId: transmissionId,
      paypalTransmissionTime: transmissionTime,
      paypalTransmissionSig: transmissionSig,
      paypalCertUrl: certUrl,
      paypalAuthAlgo: authAlgo,
    });
    const raw: unknown = await this.commandBus.execute(
      new ReceiveWebhookCommand(req.rawBody as Buffer),
    );
    if (!isReceiveWebhookResult(raw)) {
      throw new InternalServerErrorException('Invalid webhook handler result');
    }
    return {
      ok: true,
      duplicate: raw.duplicate,
    } satisfies ReceiveWebhookResponseDto;
  }
}
