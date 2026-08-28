import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { parseWithSchema } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/auth.js';
import { haircutService } from './haircut.service.js';
import { createHaircutSessionSchema, generateHaircutGuideSchema } from './haircut.validation.js';

export const haircutRouter = Router();

haircutRouter.post(
  '/haircut/sessions',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(createHaircutSessionSchema, request.body);
    const result = await haircutService.createSession(payload, request.userId!);
    return sendSuccess(response, result, 201);
  })
);

haircutRouter.get(
  '/haircut/sessions/:id',
  requireAuth,
  asyncHandler(async (request, response) => {
    const id = Array.isArray(request.params.id) ? request.params.id[0]! : request.params.id!;
    const result = await haircutService.getSession(id, request.userId!);
    return sendSuccess(response, result);
  })
);

haircutRouter.post(
  '/haircut/sessions/:id/more',
  requireAuth,
  asyncHandler(async (request, response) => {
    const id = Array.isArray(request.params.id) ? request.params.id[0]! : request.params.id!;
    const result = await haircutService.addMoreOptions(id, request.userId!);
    return sendSuccess(response, result);
  })
);

haircutRouter.post(
  '/haircut/guide',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(generateHaircutGuideSchema, request.body);
    const result = await haircutService.generateGuide(payload, request.userId!);
    return sendSuccess(response, result);
  })
);
