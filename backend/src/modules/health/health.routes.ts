import { Router } from 'express';

import { env } from '../../config/env.js';
import { sendSuccess } from '../../lib/api-response.js';

export const healthRouter = Router();

healthRouter.get('/health', (_request, response) =>
  sendSuccess(response, {
    status: 'ok',
    environment: env.NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  })
);
