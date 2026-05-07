import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { WebhookSignatureService } from './webhook-signature.service';
import { WebhooksController } from './webhooks.controller';
import { WEBHOOK_PROCESS_QUEUE } from './webhook-process.jobs';
import { WebhookProcessProcessor } from './webhook-process.processor';
import { WebhookProcessService } from './webhook-process.service';

const Imports = [CqrsModule, HttpModule];
const Controllers = [WebhooksController];
const Providers = [
  ...EventHandlers,
  ...CommandHandlers,
  ...QueryHandlers,
  WebhookSignatureService,
];

@Module({
  imports: [
    ...Imports,
    BullModule.registerQueue({ name: WEBHOOK_PROCESS_QUEUE }),
  ],
  controllers: [...Controllers],
  providers: [...Providers, WebhookProcessProcessor, WebhookProcessService],
})
export class WebhooksModule {}
