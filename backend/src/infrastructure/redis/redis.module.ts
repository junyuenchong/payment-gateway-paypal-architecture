import { Global, Module } from '@nestjs/common';

import { RedisConnectionService } from './redis-connection.service';

/** ----- Redis integration (shared connection for locks, etc.). ----- **/
@Global()
@Module({
  providers: [RedisConnectionService],
  exports: [RedisConnectionService],
})
export class RedisIntegrationModule {}
