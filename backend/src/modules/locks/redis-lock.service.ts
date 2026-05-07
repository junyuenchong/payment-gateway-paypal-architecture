import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

type LockHandle = {
  key: string;
  token: string;
};

@Injectable()
export class RedisLockService implements OnModuleDestroy {
  private readonly log = new Logger(RedisLockService.name);
  private readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    this.client = new Redis({
      host: this.config.get<string>('BULLMQ_REDIS_HOST') ?? 'localhost',
      port: Number(this.config.get<string>('BULLMQ_REDIS_PORT') ?? 6379),
      password: this.config.get<string>('BULLMQ_REDIS_PASSWORD') || undefined,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  async tryAcquire(key: string, ttlMs: number): Promise<LockHandle | null> {
    const token = randomUUID();
    const result = await this.client.set(key, token, 'PX', ttlMs, 'NX');
    if (result !== 'OK') return null;
    return { key, token };
  }

  async release(lock: LockHandle): Promise<void> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      await this.client.eval(script, 1, lock.key, lock.token);
    } catch (err) {
      this.log.warn(`Failed to release lock: ${lock.key}`);
      this.log.warn(err instanceof Error ? err.message : String(err));
    }
  }
}
