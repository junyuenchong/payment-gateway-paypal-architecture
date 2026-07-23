import { HttpException } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';

/** ----- Decide if a job failure should be retried by BullMQ. ----- **/
export function isRetryableJobError(error: unknown): boolean {
  if (error instanceof UnrecoverableError) {
    return false;
  }

  if (error instanceof HttpException) {
    const status = error.getStatus();
    // 408 Request Timeout, 429 Too Many Requests
    if (status === 408 || status === 429) {
      return true;
    }
    if (status >= 400 && status < 500) {
      return false;
    }
    return true;
  }

  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (
      code === 'ECONNRESET' ||
      code === 'ECONNREFUSED' ||
      code === 'ETIMEDOUT' ||
      code === 'ENOTFOUND' ||
      code === 'EAI_AGAIN'
    ) {
      return true;
    }

    const message = error.message.toLowerCase();
    if (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('socket hang up') ||
      message.includes('service unavailable') ||
      message.includes('bad gateway')
    ) {
      return true;
    }
  }

  return true;
}

/** ----- Wrap permanent failures so BullMQ stops retrying. ----- **/
export function toQueueJobError(error: unknown, fallback: string): Error {
  if (error instanceof UnrecoverableError) {
    return error;
  }

  const message =
    error instanceof Error
      ? error.message || fallback
      : typeof error === 'string' && error.trim()
        ? error
        : fallback;

  if (!isRetryableJobError(error)) {
    return new UnrecoverableError(message);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(message);
}
