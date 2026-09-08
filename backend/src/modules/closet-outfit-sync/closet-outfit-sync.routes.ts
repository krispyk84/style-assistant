import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { HttpError } from '../../lib/http-error.js';
import { parseWithSchema } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/auth.js';
import { closetOutfitSyncService } from './closet-outfit-sync.service.js';
import {
  createClosetOutfitFavouriteSchema,
  createClosetOutfitWeekPlanItemSchema,
  deleteVersionedQuerySchema,
  updateClosetOutfitFavouriteVersionedSchema,
  updateClosetOutfitWeekPlanItemVersionedSchema,
  upsertClosetOutfitFavouriteSchema,
  upsertClosetOutfitWeekPlanItemSchema,
} from './closet-outfit-sync.validation.js';

function requireParam(value: string | string[] | undefined, message: string): string {
  const resolved = Array.isArray(value) ? value[0] : value;
  if (!resolved) throw new HttpError(400, 'INVALID_REQUEST', message);
  return resolved;
}

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

// Sync redesign, Phase 1A: version-aware endpoints below, additive
// alongside the legacy endpoints above (which stay exactly as they are —
// the currently-installed frontend never calls these new routes). See
// closet-outfit-sync.repository.ts's top-of-file comment for the shared
// status-enum semantics returned in every response body below.

closetOutfitSyncRouter.post(
  '/closet-outfit-sync/favourites/version-aware',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(createClosetOutfitFavouriteSchema, request.body);
    const result = await closetOutfitSyncService.createFavouriteVersioned(request.userId!, payload);
    return sendSuccess(response, result);
  })
);

closetOutfitSyncRouter.patch(
  '/closet-outfit-sync/favourites/:id/version-aware',
  requireAuth,
  asyncHandler(async (request, response) => {
    const id = requireParam(request.params.id, 'Favourite ID is required.');
    const payload = parseWithSchema(updateClosetOutfitFavouriteVersionedSchema, request.body);
    const result = await closetOutfitSyncService.updateFavouriteVersioned(request.userId!, { id, ...payload });
    return sendSuccess(response, result);
  })
);

closetOutfitSyncRouter.delete(
  '/closet-outfit-sync/favourites/:id/version-aware',
  requireAuth,
  asyncHandler(async (request, response) => {
    const id = requireParam(request.params.id, 'Favourite ID is required.');
    const { baseVersion } = parseWithSchema(deleteVersionedQuerySchema, request.query);
    const result = await closetOutfitSyncService.deleteFavouriteVersioned(request.userId!, id, baseVersion);
    return sendSuccess(response, result);
  })
);

closetOutfitSyncRouter.post(
  '/closet-outfit-sync/week-plan/version-aware',
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = parseWithSchema(createClosetOutfitWeekPlanItemSchema, request.body);
    const result = await closetOutfitSyncService.createWeekPlanItemVersioned(request.userId!, payload);
    return sendSuccess(response, result);
  })
);

closetOutfitSyncRouter.patch(
  '/closet-outfit-sync/week-plan/:dayKey/version-aware',
  requireAuth,
  asyncHandler(async (request, response) => {
    const dayKey = requireParam(request.params.dayKey, 'Day key is required.');
    const payload = parseWithSchema(updateClosetOutfitWeekPlanItemVersionedSchema, request.body);
    const result = await closetOutfitSyncService.updateWeekPlanItemVersioned(request.userId!, { dayKey, ...payload });
    return sendSuccess(response, result);
  })
);

closetOutfitSyncRouter.delete(
  '/closet-outfit-sync/week-plan/:dayKey/version-aware',
  requireAuth,
  asyncHandler(async (request, response) => {
    const dayKey = requireParam(request.params.dayKey, 'Day key is required.');
    const { baseVersion } = parseWithSchema(deleteVersionedQuerySchema, request.query);
    const result = await closetOutfitSyncService.deleteWeekPlanItemVersioned(request.userId!, dayKey, baseVersion);
    return sendSuccess(response, result);
  })
);

// Sync redesign, Phase 2B1: reconciliation-only reads (§F of
// docs/sync-phase2a-reconciliation-spec.md). Includes tombstoned rows and
// syncVersion/deletedAt — never use for an ordinary UI list, which is what
// the plain GET routes above already correctly serve. No current caller.

closetOutfitSyncRouter.get(
  '/closet-outfit-sync/favourites/for-reconciliation',
  requireAuth,
  asyncHandler(async (request, response) => {
    const result = await closetOutfitSyncService.getFavouritesForReconciliation(request.userId!);
    return sendSuccess(response, { items: result });
  })
);

closetOutfitSyncRouter.get(
  '/closet-outfit-sync/week-plan/for-reconciliation',
  requireAuth,
  asyncHandler(async (request, response) => {
    const result = await closetOutfitSyncService.getWeekPlanForReconciliation(request.userId!);
    return sendSuccess(response, { items: result });
  })
);
