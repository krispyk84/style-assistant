import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { parseWithSchema } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/auth.js';
import { selfieReviewService } from './selfie-review.service.js';
import { selfieReviewSchema } from './selfie-review.validation.js';

export const selfieReviewRouter = Router();

selfieReviewRouter.post(
  '/selfie-review',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(selfieReviewSchema, request.body);
    const result = await selfieReviewService.createReview(payload, request.userId!);
    return sendSuccess(response, result, 201);
  })
);
