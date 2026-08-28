export class HttpError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;
  /** When true, withRetry() may retry this error (transient upstream failure) instead of rethrowing immediately. */
  retryable: boolean;

  constructor(statusCode: number, code: string, message: string, details?: unknown, retryable = false) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.retryable = retryable;
  }
}

/** Extracts a persistable {code, message} pair from any caught error, for storing alongside a 'failed' job status. */
export function describeError(error: unknown): { code: string; message: string } {
  if (error instanceof HttpError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    return { code: 'UNKNOWN_ERROR', message: error.message };
  }
  return { code: 'UNKNOWN_ERROR', message: 'An unknown error occurred.' };
}
