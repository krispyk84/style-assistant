import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { parseWithSchema } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/auth.js';
import { seasonalColorsService } from './seasonal-colors.service.js';
import { ensureSeasonalColorsSchema, getSeasonalColorsReportSchema } from './seasonal-colors.validation.js';

export const seasonalColorsRouter = Router();

// Called once per Fashion Trend Report visit. Never blocks: kicks off a
// Gemini refresh in the background only if the current season+gender+
// hemisphere has no valid palette yet, and returns immediately either way.
seasonalColorsRouter.post(
  '/seasonal-colors/ensure',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(ensureSeasonalColorsSchema, request.body);
    seasonalColorsService.ensureCurrentProfile(payload);
    return sendSuccess(response, { acknowledged: true });
  })
);

// Debug/manual refresh (Settings advanced section) — forces a fresh Gemini
// call regardless of whether a current palette already exists.
seasonalColorsRouter.post(
  '/seasonal-colors/refresh',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(ensureSeasonalColorsSchema, request.body);
    seasonalColorsService.forceRefresh(payload);
    return sendSuccess(response, { acknowledged: true });
  })
);

// Powers the "This Season's Hottest Colors" section atop the Fashion Trend
// Report — the color list itself is shared/global, but bestSuitedForUser is
// computed per requesting user from their own profile.skinTone.
seasonalColorsRouter.get(
  '/seasonal-colors/report',
  requireAuth,
  asyncHandler(async (request, response) => {
    const { fashionGender, hemisphere } = parseWithSchema(getSeasonalColorsReportSchema, request.query);
    const result = await seasonalColorsService.getColorReport(fashionGender, hemisphere, request.userId!);
    if (!result) {
      return sendSuccess(response, { available: false as const });
    }
    return sendSuccess(response, {
      available: true as const,
      isStale: result.isStale,
      generatedAt: result.generatedAt.toISOString(),
      colors: result.colors,
    });
  })
);
