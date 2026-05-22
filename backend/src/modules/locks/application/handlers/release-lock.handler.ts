/** ----- Handle release lock.handler ----- **/
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import Redis from 'ioredis';

import {
  AppConfigService,
  createRedisConnectionOptions,
} from '../../../../config';
import { toErrorMessage } from '../../../common/error.util';
import { ReleaseLockCommand } from '../commands/lock.command';

/** ----- Handle releas oc andler class ----- **/
@Injectable()
@CommandHandler(ReleaseLockCommand)
export class ReleaseLockHandler
  implements ICommandHandler<ReleaseLockCommand>, OnModuleDestroy
{
  private readonly log = new Logger(ReleaseLockHandler.name);
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
  async execute(command: ReleaseLockCommand): Promise<void> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      await this.client.eval(script, 1, command.lock.key, command.lock.token);
    } catch (err) {
      this.log.warn(`Failed to release lock: ${command.lock.key}`);
      this.log.warn(toErrorMessage(err, 'Release lock failed'));
    }
  }

  /** ----- Handle o odul estroy method ----- **/
  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
