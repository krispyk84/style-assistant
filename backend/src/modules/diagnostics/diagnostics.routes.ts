import { Router } from 'express';

import { sendSuccess } from '../../lib/api-response.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { prisma } from '../../db/prisma.js';

export const diagnosticsRouter = Router();

// One-off diagnostic for the closet-outfit-favourites cloud-backup data-loss
// incident — reports raw counts straight from the database (bypassing
// Supabase's client-side RLS layer entirely, since Prisma connects directly
// to Postgres) so we can tell "never made it to the cloud" apart from "is in
// the cloud but the client isn't fetching it correctly." Scoped strictly to
// the requesting user's own id — never exposes any other user's data.
diagnosticsRouter.get(
  '/diagnostics/cloud-backup-status',
  requireAuth,
  asyncHandler(async (request, response) => {
    const userId = request.userId!;

    const [savedOutfitsRows, closetItemsRows, weekPlanRows] = await Promise.all([
      prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM saved_outfits WHERE user_id = ${userId}`,
      prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM closet_items WHERE user_id = ${userId}`,
      prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM week_plan WHERE user_id = ${userId}`,
    ]);

    const closetOutfitFavouritesCount = await prisma.closetOutfitFavourite.count({ where: { supabaseUserId: userId } });
    const closetOutfitWeekPlanCount = await prisma.closetOutfitWeekPlanItem.count({ where: { supabaseUserId: userId } });

    return sendSuccess(response, {
      savedOutfitsInCloud: Number(savedOutfitsRows[0]?.count ?? 0),
      closetItemsInCloud: Number(closetItemsRows[0]?.count ?? 0),
      weekPlanInCloud: Number(weekPlanRows[0]?.count ?? 0),
      closetOutfitFavouritesInCloud: closetOutfitFavouritesCount,
      closetOutfitWeekPlanInCloud: closetOutfitWeekPlanCount,
    });
  })
);
