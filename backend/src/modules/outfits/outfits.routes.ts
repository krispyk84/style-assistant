import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { HttpError } from '../../lib/http-error.js';
import { parseWithSchema } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/auth.js';
import { outfitsService } from './outfits.service.js';
import { generateOutfitsSchema, regenerateTierSchema } from './outfits.validation.js';

export const outfitsRouter = Router();

outfitsRouter.get(
  '/outfits/:id/sketch/:tier',
  asyncHandler(async (request, response) => {
    const requestId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const tier = Array.isArray(request.params.tier) ? request.params.tier[0] : request.params.tier;

    if (!requestId || !tier) {
      throw new HttpError(400, 'INVALID_OUTFIT_REQUEST', 'The outfit sketch request is incomplete.');
    }

    if (tier !== 'business' && tier !== 'smart-casual' && tier !== 'casual') {
      throw new HttpError(400, 'INVALID_TIER', 'The provided outfit tier is not supported.');
    }

    const sketch = await outfitsService.getTierSketch(requestId, tier);

    if ('redirectUrl' in sketch) {
      return response.redirect(sketch.redirectUrl ?? '/');
    }

    response.setHeader('Content-Type', sketch.mimeType);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return response.send(sketch.data);
  })
);

outfitsRouter.get(
  '/outfits/history',
  requireAuth,
  asyncHandler(async (request, response) => {
    const page = Math.max(1, parseInt(String(request.query.page ?? '1'), 10) || 1);
    const limit = Math.min(20, Math.max(1, parseInt(String(request.query.limit ?? '5'), 10) || 5));
    const result = await outfitsService.getOutfitHistory(request.userId!, { page, limit });
    return sendSuccess(response, result);
  })
);

outfitsRouter.delete(
  '/outfits/:id',
  requireAuth,
  asyncHandler(async (request, response) => {
    const requestId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    await outfitsService.deleteOutfit(requestId, request.userId!);
    return sendSuccess(response, { deleted: true });
  })
);

outfitsRouter.get(
  '/outfits/:id',
  asyncHandler(async (request, response) => {
    const requestId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const result = await outfitsService.getOutfitResult(requestId);
    return sendSuccess(response, result);
  })
);

outfitsRouter.post(
  '/outfits/generate',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(generateOutfitsSchema, request.body);
    const result = await outfitsService.generateOutfits(payload, request.userId!);
    return sendSuccess(response, result, 201);
  })
);

outfitsRouter.post(
  '/outfits/:id/regenerate-tier',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(regenerateTierSchema, request.body);
    const requestId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const result = await outfitsService.regenerateTier(requestId, payload.tier, request.userId!);
    return sendSuccess(response, result);
  })
);
