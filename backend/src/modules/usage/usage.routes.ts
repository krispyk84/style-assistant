import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { usageService } from './usage.service.js';

export const usageRouter = Router();

usageRouter.get(
  '/usage/monthly',
  requireAuth,
  asyncHandler(async (request, response) => {
    const totalCostUsd = await usageService.getMonthlyTotal(request.userId!);
    return sendSuccess(response, { totalCostUsd });
  })
);
