import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { PrismaModule } from '../prisma/prisma.module';
import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { IdempotencyController } from './idempotency.controller';
import { IdempotencyRepository } from './idempotency.repository';
import { IdempotencyService } from './idempotency.service';

const providers = [
  IdempotencyService,
  IdempotencyRepository,
  ...EventHandlers,
  ...CommandHandlers,
  ...QueryHandlers,
];

/** ----- Configure idempotency module. ----- **/
@Module({
  imports: [CqrsModule, PrismaModule],
  controllers: [IdempotencyController],
  providers,
  exports: [IdempotencyService],
})
/** ----- Handle idempotency module class. ----- **/
export class IdempotencyModule {}
