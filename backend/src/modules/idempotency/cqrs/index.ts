import { FindProcessedExternalEventHandler } from '../application/handlers/find-processed-external-event.handler';
import { FindWebhookByExternalEventIdHandler } from '../application/handlers/find-webhook-by-external-event-id.handler';
import { RecordWebhookAndMarkProcessedHandler } from '../application/handlers/record-webhook-and-mark-processed.handler';

export const CommandHandlers = [
  FindProcessedExternalEventHandler,
  FindWebhookByExternalEventIdHandler,
  RecordWebhookAndMarkProcessedHandler,
];

export const QueryHandlers: never[] = [];
export const EventHandlers: never[] = [];
