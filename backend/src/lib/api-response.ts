import type { Response } from 'express';

import type { ApiResponse } from '../contracts/common.contracts.js';

export function sendSuccess<T>(response: Response, data: T, statusCode = 200) {
  const payload: ApiResponse<T> = {
    success: true,
    data,
    error: null,
  };

  return response.status(statusCode).json(payload);
}

export function sendError(
  response: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
) {
  const payload: ApiResponse<null> = {
    success: false,
    data: null,
    error: {
      code,
      message,
      details,
    },
  };

  return response.status(statusCode).json(payload);
}
