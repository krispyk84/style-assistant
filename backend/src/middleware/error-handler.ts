import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { logger } from '../config/logger.js';
import { sendError } from '../lib/api-response.js';
import { HttpError } from '../lib/http-error.js';

export function errorHandler(error: unknown, request: Request, response: Response, _next: NextFunction) {
  if (error instanceof HttpError) {
    return sendError(response, error.statusCode, error.code, error.message, error.details);
  }

  if (error instanceof ZodError) {
    return sendError(response, 400, 'VALIDATION_ERROR', 'Request validation failed.', error.flatten());
  }

  logger.error(
    {
      method: request.method,
      path: request.path,
      error,
    },
    'Unhandled request error'
  );

  return sendError(response, 500, 'INTERNAL_SERVER_ERROR', 'Unexpected server error.');
}
