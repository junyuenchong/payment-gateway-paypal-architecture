/** ----- Handle idempotency.command ----- **/
import type { Prisma } from '@prisma/client';

export type RecordWebhookParams = {
  eventId: string;
  type: string;
  payload: Prisma.InputJsonValue;
};

/** ----- Handle fin rocesse xterna ven ommand class ----- **/
export class FindProcessedExternalEventCommand {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(public readonly eventId: string) {}
}

/** ----- Handle fin ebhoo  xterna ven  ommand class ----- **/
export class FindWebhookByExternalEventIdCommand {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(public readonly eventId: string) {}
}

/** ----- Handle recor ebhoo n ar rocesse ommand class ----- **/
export class RecordWebhookAndMarkProcessedCommand {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(public readonly params: RecordWebhookParams) {}
}
