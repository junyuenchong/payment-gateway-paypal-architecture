import { Injectable, Logger } from '@nestjs/common';

import { toError } from '../../common/shared/helpers/error.util';
import { RedisConnectionService } from '../redis/redis-connection.service';
import type { LockHandle } from './dto/lock.dto';
import {
  releaseRedisLock,
  tryAcquireRedisLock,
} from './helpers/redis-lock.helper';

/** ----- Redis distributed locks (cross-instance). ----- **/
@Injectable()
export class RedisLockService {
  private readonly log = new Logger(RedisLockService.name);

  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly redis: RedisConnectionService) {}

  /** ----- Try acquire distributed lock ----- **/
  async tryAcquire(key: string, ttlMs: number): Promise<LockHandle | null> {
    try {
      return await tryAcquireRedisLock(this.redis.client, key, ttlMs);
    } catch (error: unknown) {
      const normalized = toError(error, 'Lock acquire failed');
      this.log.error(`Failed to acquire lock: ${key}`);
      this.log.error(normalized.stack ?? normalized.message);
      throw normalized;
    }
  }

  /** ----- Release distributed lock ----- **/
  async release(lock: LockHandle): Promise<void> {
    try {
      await releaseRedisLock(this.redis.client, lock, this.log);
    } catch (error: unknown) {
      const normalized = toError(error, 'Lock release failed');
      this.log.error(`Failed to release lock: ${lock.key}`);
      this.log.error(normalized.stack ?? normalized.message);
      throw normalized;
    }
  }
}
