import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { LocksController } from './locks.controller';
import { LocksRepository } from './locks.repository';
import { RedisLockService } from './redis-lock.service';

/** ----- Configure Redis distributed locks module. ----- **/
@Module({
  imports: [CqrsModule],
  controllers: [LocksController],
  providers: [
    RedisLockService,
    LocksRepository,
    ...EventHandlers,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [RedisLockService],
})
/** ----- Handle lock odule class ----- **/
export class LocksModule {}
