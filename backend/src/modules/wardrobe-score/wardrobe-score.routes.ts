import { Router } from 'express';
import { z } from 'zod';

import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { closetRepository } from '../closet/closet.repository.js';
import { computeWardrobeScore } from './composite-score.service.js';
import { trendRelevanceService } from './trend-relevance.service.js';
import type { ScoringClosetItem } from './wardrobe-score.types.js';

export const wardrobeScoreRouter = Router();

const querySchema = z.object({
  force: z.enum(['true', '1', 'false', '0']).optional().transform((v) => v === 'true' || v === '1'),
});

/**
 * GET /wardrobe/score
 * Returns the full Wardrobe Intelligence Score for the authenticated user.
 *
 * Query params:
 *   force=true  — bypass trend relevance cache and recompute
 */
wardrobeScoreRouter.get(
  '/wardrobe/score',
  requireAuth,
  asyncHandler(async (request, response) => {
    const { force } = querySchema.parse(request.query);
    const supabaseUserId = request.userId!;

    // Fetch the user's closet
    const rawItems = await closetRepository.getItems(supabaseUserId);

    // Map to scoring shape — only the fields scoring services need
    const items: ScoringClosetItem[] = rawItems.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      subcategory: item.subcategory ?? null,
      brand: item.brand || null,
      primaryColor: item.primaryColor ?? null,
      colorFamily: item.colorFamily ?? null,
      material: item.material ?? null,
      formality: item.formality ?? null,
      silhouette: item.silhouette ?? null,
      pattern: item.pattern ?? null,
      weight: item.weight ?? null,
    }));

    const score = await computeWardrobeScore(items, {
      supabaseUserId,
      forceTrendRefresh: force,
    });

    return sendSuccess(response, score);
  })
);

/**
 * POST /wardrobe/score/invalidate-trend-cache
 * Invalidates the cached trend relevance result for the authenticated user.
 * Should be called when the user uploads a new style guide.
 */
wardrobeScoreRouter.post(
  '/wardrobe/score/invalidate-trend-cache',
  requireAuth,
  asyncHandler(async (request, response) => {
    trendRelevanceService.invalidateCache(request.userId!);
    return sendSuccess(response, { invalidated: true });
  })
);
