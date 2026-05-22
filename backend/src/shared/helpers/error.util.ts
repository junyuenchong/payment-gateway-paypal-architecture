import type { Logger } from '@nestjs/common';

/** ----- Normalize unknown error into safe message. ----- **/
export function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string' && error.trim()) return error;
  if (error === undefined) return `${fallback} (cause: undefined)`;
  if (error === null) return `${fallback} (cause: null)`;

  if (typeof error === 'object') {
    try {
      const text = JSON.stringify(error);
      if (text && text !== '{}' && text !== '[]')
        return `${fallback} (cause: ${text})`;
    } catch {
      // ignore stringify failures
    }
  }

  return fallback;
}

/** ----- Normalize unknown error into Error instance. ----- **/
export function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  return new Error(toErrorMessage(error, fallback));
}

/** ----- Log normalized error and throw. ----- **/
export function logErrorAndThrow(
  logger: Logger,
  error: unknown,
  fallback: string,
  context: string,
): never {
  const normalized = toError(error, fallback);
  logger.error(context);
  logger.error(normalized.stack ?? normalized.message);
  throw normalized;
}

/** ----- Log normalized error without throwing. ----- **/
export function logErrorNormalized(
  logger: Logger,
  error: unknown,
  fallback: string,
  context: string,
): void {
  const normalized = toError(error, fallback);
  logger.error(context);
  logger.error(normalized.stack ?? normalized.message);
}

/** ----- Log normalized warning. ----- **/
export function logWarnNormalized(
  logger: Logger,
  error: unknown,
  fallback: string,
  context: string,
): void {
  const normalized = toError(error, fallback);
  logger.warn(context);
  logger.warn(normalized.message);
}
