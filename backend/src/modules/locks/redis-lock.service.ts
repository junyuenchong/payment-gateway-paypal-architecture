import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import { toError } from '../../shared/helpers/error.util';
import type { LockHandle } from './application/commands/lock.command';
import {
  ReleaseLockCommand,
  TryAcquireLockCommand,
} from './application/commands/lock.command';

/** ----- Handle redis lock operations ----- **/
@Injectable()
export class RedisLockService {
  private readonly log = new Logger(RedisLockService.name);

  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly commandBus: CommandBus) {}

  /** ----- Try acquire distributed lock ----- **/
  async tryAcquire(key: string, ttlMs: number): Promise<LockHandle | null> {
    return this.commandBus
      .execute<
        TryAcquireLockCommand,
        LockHandle | null
      >(new TryAcquireLockCommand(key, ttlMs))
      .catch((error: unknown) => {
        const normalized = toError(error, 'Lock acquire failed');
        this.log.error(`Failed to acquire lock: ${key}`);
        this.log.error(normalized.stack ?? normalized.message);
        throw normalized;
      });
  }

  /** ----- Release distributed lock ----- **/
  async release(lock: LockHandle): Promise<void> {
    await this.commandBus
      .execute(new ReleaseLockCommand(lock))
      .catch((error: unknown) => {
        const normalized = toError(error, 'Lock release failed');
        this.log.error(`Failed to release lock: ${lock.key}`);
        this.log.error(normalized.stack ?? normalized.message);
        throw normalized;
      });
  }
}
