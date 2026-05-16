import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { parseWithSchema } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/auth.js';
import { closetFitCheckRequestSchema } from './closet-fit-check.schemas.js';
import { closetFitCheckService } from './closet-fit-check.service.js';

export const closetFitCheckRouter = Router();

closetFitCheckRouter.post(
  '/closet/fit-check',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(closetFitCheckRequestSchema, request.body);
    const result = await closetFitCheckService.evaluate(payload, request.userId!);
    return sendSuccess(response, result);
  }),
);
