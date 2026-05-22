import { Global, Module } from '@nestjs/common';

/** ----- Redis integration (connection helpers; locks use ioredis directly). ----- **/
@Global()
@Module({})
export class RedisIntegrationModule {}
