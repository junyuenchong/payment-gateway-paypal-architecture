import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { IdempotencyController } from './idempotency.controller';
import { IdempotencyRepository } from './idempotency.repository';
import { IdempotencyService } from './idempotency.service';

/** ----- Configure webhook idempotency module. ----- **/
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [IdempotencyController],
  providers: [
    IdempotencyService,
    IdempotencyRepository,
    ...EventHandlers,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [IdempotencyService],
})
/** ----- Handle idempotenc odule class ----- **/
export class IdempotencyModule {}
