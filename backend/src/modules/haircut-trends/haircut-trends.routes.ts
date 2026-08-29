import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { parseWithSchema } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/auth.js';
import { haircutTrendsService } from './haircut-trends.service.js';
import { ensureHaircutTrendsSchema, getHaircutTrendsSchema } from './haircut-trends.validation.js';

export const haircutTrendsRouter = Router();

// Called once per Haircut Planner visit. Never blocks: kicks off a Gemini
// refresh in the background only if the current season+hemisphere has no
// valid profile yet, and returns immediately either way.
haircutTrendsRouter.post(
  '/haircut-trends/ensure',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(ensureHaircutTrendsSchema, request.body);
    haircutTrendsService.ensureCurrentProfile(payload);
    return sendSuccess(response, { acknowledged: true });
  })
);

// Debug/manual refresh — forces a fresh Gemini call regardless of whether a
// current profile already exists.
haircutTrendsRouter.post(
  '/haircut-trends/refresh',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(ensureHaircutTrendsSchema, request.body);
    haircutTrendsService.forceRefresh(payload);
    return sendSuccess(response, { acknowledged: true });
  })
);

// Powers the "Hairstyle Trend Report" modal — returns the current (or, if
// none yet, most recent stale) top-20 style list for display.
haircutTrendsRouter.get(
  '/haircut-trends/current',
  requireAuth,
  asyncHandler(async (request, response) => {
    const { fashionGender, hemisphere } = parseWithSchema(getHaircutTrendsSchema, request.query);
    const result = await haircutTrendsService.getCurrentTrendProfile(fashionGender, hemisphere);
    if (!result) {
      return sendSuccess(response, { available: false as const });
    }
    return sendSuccess(response, {
      available: true as const,
      isStale: result.isStale,
      generatedAt: result.profile.generatedAt.toISOString(),
      styles: result.profile.styles,
    });
  })
);
