/** ----- Handle try acquire lock.handler ----- **/
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';

import { AppConfigService } from '../../../../config';
import { createRedisConnectionOptions } from '../../../../integrations/redis/redis-connection';
import {
  TryAcquireLockCommand,
  type LockHandle,
} from '../commands/lock.command';

/** ----- Handle tr cquir oc andler class ----- **/
@Injectable()
@CommandHandler(TryAcquireLockCommand)
export class TryAcquireLockHandler
  implements
    ICommandHandler<TryAcquireLockCommand, LockHandle | null>,
    OnModuleDestroy
{
  private readonly client: Redis;

  /** ----- Handle constructor dependency wiring ----- **/
  constructor(cfg: AppConfigService) {
    this.client = new Redis({
      ...createRedisConnectionOptions(cfg.redis),
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
    });
  }

  /** ----- Handle execute method ----- **/
  async execute(command: TryAcquireLockCommand): Promise<LockHandle | null> {
    const token = randomUUID();
    const result = await this.client.set(
      command.key,
      token,
      'PX',
      command.ttlMs,
      'NX',
    );
    if (result !== 'OK') return null;
    return { key: command.key, token };
  }

  /** ----- Handle o odul estroy method ----- **/
  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
