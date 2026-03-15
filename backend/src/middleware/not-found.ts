import type { Request, Response } from 'express';

import { sendError } from '../lib/api-response.js';

export function notFoundHandler(_request: Request, response: Response) {
  return sendError(response, 404, 'NOT_FOUND', 'Route not found.');
}
