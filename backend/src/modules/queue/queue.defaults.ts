import type { JobsOptions } from 'bullmq';
import type { ConfigService } from '@nestjs/config';

function toPositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === 'string' ? Number(value) : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** ----- Build default queue retry and cleanup options. ----- **/
export function buildDefaultJobOptions(config: ConfigService): JobsOptions {
  const attempts = toPositiveInt(config.get('BULLMQ_JOB_ATTEMPTS'), 5);
  const backoffDelayMs = toPositiveInt(
    config.get('BULLMQ_JOB_BACKOFF_DELAY_MS'),
    1000,
  );
  const removeOnFail = toPositiveInt(config.get('BULLMQ_REMOVE_ON_FAIL'), 1000);

  return {
    attempts,
    backoff: { type: 'exponential', delay: backoffDelayMs },
    removeOnComplete: true,
    removeOnFail,
  };
}
