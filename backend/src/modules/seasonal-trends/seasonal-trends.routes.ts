import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { parseWithSchema } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/auth.js';
import { seasonalTrendsService } from './seasonal-trends.service.js';
import { trendFeedbackService } from './trend-feedback.service.js';
import { ensureSeasonalTrendsSchema, getSeasonalTrendsReportSchema, setTrendFeedbackSchema } from './seasonal-trends.validation.js';

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

// Powers the "Fashion Trend Report" card on Home — flattens the three
// formality-specific lists into a single ranked top-20 for display.
seasonalTrendsRouter.get(
  '/seasonal-trends/report',
  requireAuth,
  asyncHandler(async (request, response) => {
    const { fashionGender, hemisphere } = parseWithSchema(getSeasonalTrendsReportSchema, request.query);
    const result = await seasonalTrendsService.getTrendReport(fashionGender, hemisphere, request.userId!);
    if (!result) {
      return sendSuccess(response, { available: false as const });
    }
    return sendSuccess(response, {
      available: true as const,
      isStale: result.isStale,
      generatedAt: result.generatedAt.toISOString(),
      trends: result.trends,
    });
  })
);

// User's personal thumbs up/down on a trend — a soft per-user bias applied
// to outfit-generation prompt weighting, not a correction shared globally.
seasonalTrendsRouter.post(
  '/seasonal-trends/feedback',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(setTrendFeedbackSchema, request.body);
    await trendFeedbackService.setFeedback(request.userId!, payload.fashionGender, payload.trendName, payload.feedback);
    return sendSuccess(response, { acknowledged: true });
  })
);
