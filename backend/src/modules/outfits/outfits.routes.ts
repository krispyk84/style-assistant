import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { parseWithSchema } from '../../lib/validation.js';
import { outfitsService } from './outfits.service.js';
import { generateOutfitsSchema, regenerateTierSchema } from './outfits.validation.js';

export const outfitsRouter = Router();

outfitsRouter.post(
  '/outfits/generate',
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(generateOutfitsSchema, request.body);
    const result = await outfitsService.generateOutfits(payload);
    return sendSuccess(response, result, 201);
  })
);

outfitsRouter.post(
  '/outfits/:id/regenerate-tier',
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(regenerateTierSchema, request.body);
    const requestId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const result = await outfitsService.regenerateTier(requestId, payload.tier);
    return sendSuccess(response, result);
  })
);
