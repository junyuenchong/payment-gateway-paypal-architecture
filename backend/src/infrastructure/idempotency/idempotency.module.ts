import { Module } from '@nestjs/common';

import { IdempotencyController } from './idempotency.controller';
import { IdempotencyService } from './idempotency.service';

/** ----- Configure idempotency module. ----- **/
@Module({
  controllers: [IdempotencyController],
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
