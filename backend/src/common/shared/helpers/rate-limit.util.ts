import type { ExecutionContext } from '@nestjs/common';

/** ----- Build rate-limit tracker from API key or client IP. ----- **/
export function rateLimitTracker(
  req: Record<string, unknown>,
  context: ExecutionContext,
): string {
  void context;
  const headers = req.headers as Record<string, unknown> | undefined;
  const apiKey = headers?.['x-api-key'];
  if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
    return `key:${apiKey.trim()}`;
  }

  const ip =
    (typeof req.ip === 'string' && req.ip) ||
    (req.socket as { remoteAddress?: string } | undefined)?.remoteAddress ||
    'unknown';
  return `ip:${ip}`;
}
