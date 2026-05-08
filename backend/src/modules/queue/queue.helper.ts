import { Logger } from '@nestjs/common';
import type { JobsOptions, Queue } from 'bullmq';

import { toError } from '../common/error.util';
import { JOBS } from './queue.constant';

/** ----- Enqueue queue job with standard logging. ----- **/
export function enqueueQueueJob(params: {
  queue: Queue;
  logger: Logger;
  name: (typeof JOBS)[keyof typeof JOBS];
  data: unknown;
  jobId: string;
  opts?: JobsOptions;
}): Promise<void> {
  return params.queue
    .add(params.name, params.data, {
      jobId: params.jobId,
      ...(params.opts ?? {}),
    })
    .then(() => {})
    .catch((error: unknown) => {
      const normalized = toError(error, 'Queue enqueue failed');
      params.logger.error(
        `Failed to enqueue job: ${params.name} (${params.jobId})`,
      );
      params.logger.error(normalized.stack ?? normalized.message);
      throw normalized;
    });
}
