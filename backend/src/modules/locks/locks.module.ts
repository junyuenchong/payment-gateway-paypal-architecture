import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CommandHandlers, EventHandlers, QueryHandlers } from './cqrs';
import { LocksController } from './locks.controller';
import { LocksRepository } from './locks.repository';
import { RedisLockService } from './redis-lock.service';

/** ----- Configure Redis distributed locks module. ----- **/
@Global()
@Module({
  imports: [ConfigModule],
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
