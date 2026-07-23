import { describe, expect, it } from '@jest/globals';
import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';

import {
  isRetryableJobError,
  toQueueJobError,
} from './job-retry.helper';

/** ----- job-retry.helper unit tests ----- **/
describe('job-retry.helper', () => {
  it('treats 4xx BadRequest as permanent', () => {
    expect(isRetryableJobError(new BadRequestException('bad card'))).toBe(
      false,
    );
    expect(toQueueJobError(new BadRequestException('bad card'), 'x')).toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it('treats 502 BadGateway as retryable', () => {
    expect(isRetryableJobError(new BadGatewayException('down'))).toBe(true);
    expect(toQueueJobError(new BadGatewayException('down'), 'x')).toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('treats network errno as retryable', () => {
    const err = new Error('connect failed') as NodeJS.ErrnoException;
    err.code = 'ECONNRESET';
    expect(isRetryableJobError(err)).toBe(true);
  });
});
