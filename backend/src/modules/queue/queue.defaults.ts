import type { JobsOptions } from 'bullmq';

import type { AppConfigService } from '../../config';

/** ----- Build default BullMQ job options from app config. ----- **/
export function buildDefaultJobOptions(cfg: AppConfigService): JobsOptions {
  return {
    attempts: cfg.bullmq.jobAttempts,
    backoff: {
      type: 'exponential',
      delay: cfg.bullmq.jobBackoffDelayMs,
    },
    removeOnFail: cfg.bullmq.removeOnFail,
  };
}
