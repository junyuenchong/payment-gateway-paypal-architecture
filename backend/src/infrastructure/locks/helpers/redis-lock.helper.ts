import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type Redis from 'ioredis';

import { toErrorMessage } from '../../../common/shared/helpers/error.util';
import type { LockHandle } from '../dto/lock.dto';

/** ----- Lua: release only if token matches. ----- **/
export const RELEASE_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

/** ----- SET key token NX PX ttlMs. ----- **/
export async function tryAcquireRedisLock(
  client: Redis,
  key: string,
  ttlMs: number,
): Promise<LockHandle | null> {
  const token = randomUUID();
  const result = await client.set(key, token, 'PX', ttlMs, 'NX');
  if (result !== 'OK') return null;
  return { key, token };
}

/** ----- Release lock; log and swallow errors. ----- **/
export async function releaseRedisLock(
  client: Redis,
  lock: LockHandle,
  log: Logger,
): Promise<void> {
  try {
    await client.eval(RELEASE_LOCK_SCRIPT, 1, lock.key, lock.token);
  } catch (err) {
    log.warn(`Failed to release lock: ${lock.key}`);
    log.warn(toErrorMessage(err, 'Release lock failed'));
  }
}
