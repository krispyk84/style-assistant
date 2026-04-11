import { logger } from '../config/logger.js';
import { HttpError } from '../lib/http-error.js';

export const MAX_RETRIES = 2;

export type WithRetryOptions = {
  /** Number of retries after the initial attempt. 0 = single attempt, no retry. */
  maxRetries: number;
  timeoutMs: number;
  feature?: string;
  timeoutCode: string;
  timeoutMessage: string;
  unavailableCode: string;
  unavailableMessage: string;
};

/**
 * Wraps an async operation with per-attempt AbortController timeout and
 * optional exponential-backoff retry on timeout (AbortError only).
 *
 * Retry policy:
 *   - HttpError thrown by fn → re-throw immediately, no retry
 *   - AbortError (timeout fired) → retry if attempts remain, else throw 504
 *   - Any other error → throw HttpError 502 immediately, no retry
 *
 * The caller's fn receives a fresh AbortSignal on each attempt.
 */
export async function withRetry<T>(
  options: WithRetryOptions,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    if (attempt > 0) {
      const delayMs = 1000 * 2 ** (attempt - 1); // 1s, 2s, …
      logger.warn({ feature: options.feature, attempt, delayMs }, 'OpenAI request timed out, retrying');
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      return await fn(controller.signal);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        // Will retry on next loop iteration (if attempts remain).
        // On the final attempt, continue exits the loop and throws 504 below.
        continue;
      }

      logger.error({ error }, 'Unexpected OpenAI client failure');
      throw new HttpError(502, options.unavailableCode, options.unavailableMessage);
    } finally {
      clearTimeout(timeout);
    }
  }

  logger.error(
    { feature: options.feature, attempts: options.maxRetries + 1 },
    'OpenAI request timed out after all retries',
  );
  throw new HttpError(504, options.timeoutCode, options.timeoutMessage);
}
