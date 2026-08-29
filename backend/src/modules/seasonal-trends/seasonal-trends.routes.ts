import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { parseWithSchema } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/auth.js';
import { seasonalTrendsService } from './seasonal-trends.service.js';
import { ensureSeasonalTrendsSchema } from './seasonal-trends.validation.js';

export const seasonalTrendsRouter = Router();

// Called once per app launch (and after a fashion-gender change). Never
// blocks: kicks off a Gemini refresh in the background only if the current
// season+gender+hemisphere has no valid profile yet, and returns immediately
// either way — the client doesn't need the profile itself, it only needs to
// know the check happened.
seasonalTrendsRouter.post(
  '/seasonal-trends/ensure',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(ensureSeasonalTrendsSchema, request.body);
    seasonalTrendsService.ensureCurrentProfile(payload);
    return sendSuccess(response, { acknowledged: true });
  })
);

// Debug/manual refresh (Settings advanced section) — forces a fresh Gemini
// call regardless of whether a current profile already exists.
seasonalTrendsRouter.post(
  '/seasonal-trends/refresh',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(ensureSeasonalTrendsSchema, request.body);
    seasonalTrendsService.forceRefresh(payload);
    return sendSuccess(response, { acknowledged: true });
  })
);
