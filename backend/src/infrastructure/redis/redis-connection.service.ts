import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

import { AppConfigService } from '../../common/config';
import { createRedisConnectionOptions } from './redis-connection';

/** ----- Shared ioredis client for locks and other integrations. ----- **/
@Injectable()
export class RedisConnectionService implements OnModuleDestroy {
  readonly client: Redis;

  /** ----- Handle constructor dependency wiring ----- **/
  constructor(cfg: AppConfigService) {
    this.client = new Redis({
      ...createRedisConnectionOptions(cfg.redis),
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
    });
  }

  /** ----- Close Redis on shutdown. ----- **/
  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
