import { env } from '../lib/env';
import { toErrorMessage } from '../lib/error';
import { z } from 'zod';

/**
 * ------------------------------------------------------
 * API Error Payload Schema
 * ------------------------------------------------------
 */
const ApiErrorSchema = z.object({
  message: z.union([z.string(), z.array(z.string())]).optional(),
  error: z.string().optional(),
  statusCode: z.number().optional(),
  timestamp: z.string().optional(),
  path: z.string().optional(),
});

/**
 * ------------------------------------------------------
 * Generic API Request Wrapper
 * ------------------------------------------------------
 */
export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  schema?: z.ZodSchema<T>,
): Promise<T> {
  try {
    const response = await fetch(`${env.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      let detail = '';
      try {
        const parsed = ApiErrorSchema.safeParse(await response.json());
        if (parsed.success && Array.isArray(parsed.data.message)) {
          detail = parsed.data.message.join(', ');
        } else if (parsed.success) {
          detail =
            typeof parsed.data.message === 'string'
              ? parsed.data.message
              : (parsed.data.error ?? '');
        } else {
          detail = '';
        }
      } catch {
        // ignore parse failure and fallback to generic detail
      }

      const suffix = detail ? `: ${detail}` : '';
      throw new Error(
        `API request failed (${response.status}) for ${path}${suffix}`,
      );
    }

    const responseBody = (await response.json()) as unknown;
    if (!schema) {
      return responseBody as T;
    }

    const parsed = schema.safeParse(responseBody);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map(
          (issue) => `${issue.path.join('.') || 'response'}: ${issue.message}`,
        )
        .join(', ');
      throw new Error(`Invalid API response for ${path}: ${details}`);
    }

    return parsed.data;
  } catch (error) {
    throw new Error(
      toErrorMessage(error, `Network request failed for ${path}`),
      { cause: error },
    );
  }
}
