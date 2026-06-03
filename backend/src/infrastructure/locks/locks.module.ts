import { Module } from '@nestjs/common';

import { LocksController } from './locks.controller';
import { RedisLockService } from './redis-lock.service';

/** ----- Configure Redis distributed locks module. ----- **/
@Module({
  controllers: [LocksController],
  providers: [RedisLockService],
  exports: [RedisLockService],
})
export class LocksModule {}
