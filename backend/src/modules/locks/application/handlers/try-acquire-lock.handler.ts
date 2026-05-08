/** ----- Handle try acquire lock.handler ----- **/
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';

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
  constructor(private readonly config: ConfigService) {
    this.client = new Redis({
      host: this.config.get<string>('BULLMQ_REDIS_HOST') ?? 'localhost',
      port: Number(this.config.get<string>('BULLMQ_REDIS_PORT') ?? 6379),
      password: this.config.get<string>('BULLMQ_REDIS_PASSWORD') || undefined,
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
