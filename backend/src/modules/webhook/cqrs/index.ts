import { ReceiveWebhookHandler } from '../application/handlers/receive-webhook.handler';

/** ----- Define webhook command handlers ----- **/
export const CommandHandlers = [ReceiveWebhookHandler];

/** ----- Define webhook query handlers ----- **/
export const QueryHandlers: never[] = [];

/** ----- Define webhook event handlers ----- **/
export const EventHandlers: never[] = [];
