import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { parseWithSchema } from '../../lib/validation.js';
import { compatibilityService } from './compatibility.service.js';
import { compatibilityCheckSchema } from './compatibility.validation.js';

export const compatibilityRouter = Router();

compatibilityRouter.post(
  '/compatibility-check',
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(compatibilityCheckSchema, request.body);
    const result = await compatibilityService.createCheck(payload);
    return sendSuccess(response, result, 201);
  })
);
