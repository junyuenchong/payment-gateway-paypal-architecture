import type { AppConfiguration } from '../../common/config/config.types';

/** ----- ioredis connection options from centralized redis config. ----- **/
export function createRedisConnectionOptions(redis: AppConfiguration['redis']) {
  return {
    host: redis.host,
    port: redis.port,
    password: redis.password,
  };
}
