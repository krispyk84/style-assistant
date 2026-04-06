import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { parseWithSchema } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/auth.js';
import { secondOpinionService } from './second-opinion.service.js';
import { secondOpinionSchema } from './second-opinion.validation.js';

export const secondOpinionRouter = Router();

secondOpinionRouter.post(
  '/second-opinion',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(secondOpinionSchema, request.body);
    const result = await secondOpinionService.createOpinion(payload, request.userId!);
    return sendSuccess(response, result, 201);
  })
);
