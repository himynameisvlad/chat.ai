export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatuses: number[];
}

export const defaultRetryConfig: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const {
    maxAttempts,
    initialDelayMs,
    maxDelayMs,
    backoffMultiplier,
    retryableStatuses,
  } = { ...defaultRetryConfig, ...config };

  let lastError: Error | undefined;
  let delayMs = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const shouldRetry =
        attempt < maxAttempts &&
        isRetryableError(error, retryableStatuses);

      if (!shouldRetry) {
        throw lastError;
      }

      await sleep(delayMs);
      delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError!;
}

function isRetryableError(error: unknown, retryableStatuses: number[]): boolean {
  if (error instanceof Error && 'statusCode' in error) {
    const statusCode = (error as any).statusCode;
    return retryableStatuses.includes(statusCode);
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return false;
  }

  if (error instanceof Error && error.message.includes('network')) {
    return true;
  }

  return false;
}
