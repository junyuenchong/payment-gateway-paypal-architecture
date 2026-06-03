import { Prisma } from '@prisma/client';

/** ----- Compose Prisma Client extensions here (logging, metrics, soft-delete, …). ----- **/
export const prismaClientExtension = Prisma.defineExtension({
  name: 'payment-webhook',
});
