import type { Prisma } from '@prisma/client';

/** ----- Input to persist webhook + processed marker. ----- **/
export type RecordWebhookParams = {
  eventId: string;
  type: string;
  payload: Prisma.InputJsonValue;
};

/** ----- Internal module health response. ----- **/
export type IdempotencyStatusDto = {
  ok: true;
  module: 'idempotency';
};
