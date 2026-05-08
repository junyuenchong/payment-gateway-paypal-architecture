import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import { toError } from '../common/error.util';
import {
  FindProcessedExternalEventCommand,
  FindWebhookByExternalEventIdCommand,
  RecordWebhookAndMarkProcessedCommand,
  type RecordWebhookParams,
} from './application/commands/idempotency.command';

/** ----- Handle webhook idempotency operations. ----- **/
@Injectable()
export class IdempotencyService {
  private readonly log = new Logger(IdempotencyService.name);

  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly commandBus: CommandBus) {}

  /** ----- Find processed marker by external event id. ----- **/
  findProcessedExternalEvent(eventId: string) {
    return this.commandBus
      .execute(new FindProcessedExternalEventCommand(eventId))
      .catch((error: unknown) => {
        const normalized = toError(error, 'Find processed event failed');
        this.log.error(`Failed to find processed event: ${eventId}`);
        this.log.error(normalized.stack ?? normalized.message);
        throw normalized;
      });
  }

  /** ----- Find webhook row by external event id. ----- **/
  findWebhookByExternalEventId(eventId: string) {
    return this.commandBus
      .execute(new FindWebhookByExternalEventIdCommand(eventId))
      .catch((error: unknown) => {
        const normalized = toError(error, 'Find webhook event failed');
        this.log.error(`Failed to find webhook event: ${eventId}`);
        this.log.error(normalized.stack ?? normalized.message);
        throw normalized;
      });
  }

  /** ----- Save webhook event and processed marker in one transaction. ----- **/
  recordWebhookAndMarkProcessed(params: RecordWebhookParams) {
    return this.commandBus
      .execute(new RecordWebhookAndMarkProcessedCommand(params))
      .catch((error: unknown) => {
        const normalized = toError(error, 'Record webhook failed');
        this.log.error(
          `Failed to record webhook and marker: ${params.eventId ?? 'undefined'}`,
        );
        this.log.error(normalized.stack ?? normalized.message);
        throw normalized;
      });
  }
}
