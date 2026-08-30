import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { HttpError } from '../../lib/http-error.js';
import { parseWithSchema } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/auth.js';
import { closetOutfitSyncService } from './closet-outfit-sync.service.js';
import { upsertClosetOutfitFavouriteSchema, upsertClosetOutfitWeekPlanItemSchema } from './closet-outfit-sync.validation.js';

export const closetOutfitSyncRouter = Router();

closetOutfitSyncRouter.get(
  '/closet-outfit-sync/favourites',
  requireAuth,
  asyncHandler(async (request, response) => {
    const result = await closetOutfitSyncService.getFavourites(request.userId!);
    return sendSuccess(response, { items: result });
  })
);

closetOutfitSyncRouter.post(
  '/closet-outfit-sync/favourites',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(upsertClosetOutfitFavouriteSchema, request.body);
    await closetOutfitSyncService.upsertFavourite(request.userId!, payload);
    return sendSuccess(response, { acknowledged: true });
  })
);

closetOutfitSyncRouter.delete(
  '/closet-outfit-sync/favourites/:id',
  requireAuth,
  asyncHandler(async (request, response) => {
    const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    if (!id) throw new HttpError(400, 'INVALID_REQUEST', 'Favourite ID is required.');
    await closetOutfitSyncService.deleteFavourite(request.userId!, id);
    return sendSuccess(response, { acknowledged: true });
  })
);

closetOutfitSyncRouter.get(
  '/closet-outfit-sync/week-plan',
  requireAuth,
  asyncHandler(async (request, response) => {
    const result = await closetOutfitSyncService.getWeekPlan(request.userId!);
    return sendSuccess(response, { items: result });
  })
);

closetOutfitSyncRouter.post(
  '/closet-outfit-sync/week-plan',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(upsertClosetOutfitWeekPlanItemSchema, request.body);
    await closetOutfitSyncService.upsertWeekPlanItem(request.userId!, payload);
    return sendSuccess(response, { acknowledged: true });
  })
);

closetOutfitSyncRouter.delete(
  '/closet-outfit-sync/week-plan/:dayKey',
  requireAuth,
  asyncHandler(async (request, response) => {
    const dayKey = Array.isArray(request.params.dayKey) ? request.params.dayKey[0] : request.params.dayKey;
    if (!dayKey) throw new HttpError(400, 'INVALID_REQUEST', 'Day key is required.');
    await closetOutfitSyncService.deleteWeekPlanItem(request.userId!, dayKey);
    return sendSuccess(response, { acknowledged: true });
  })
);
