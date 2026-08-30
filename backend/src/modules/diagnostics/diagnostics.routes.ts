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
//
// Each check runs independently and reports its own error string rather than
// letting one failure (e.g. a uuid/text type mismatch on a column we don't
// control the schema of) blank out every other result.
async function countOrError(label: string, run: () => Promise<number>): Promise<number | string> {
  try {
    return await run();
  } catch (error) {
    return `${label} error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

diagnosticsRouter.get(
  '/diagnostics/cloud-backup-status',
  requireAuth,
  asyncHandler(async (request, response) => {
    const userId = request.userId!;

    const [
      savedOutfitsInCloud,
      closetItemsInCloud,
      weekPlanInCloud,
      closetOutfitFavouritesInCloud,
      closetOutfitWeekPlanInCloud,
    ] = await Promise.all([
      countOrError('saved_outfits', async () => {
        const rows = await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM saved_outfits WHERE user_id = ${userId}::uuid`;
        return Number(rows[0]?.count ?? 0);
      }),
      countOrError('closet_items', async () => {
        const rows = await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM closet_items WHERE user_id = ${userId}::uuid`;
        return Number(rows[0]?.count ?? 0);
      }),
      countOrError('week_plan', async () => {
        const rows = await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM week_plan WHERE user_id = ${userId}::uuid`;
        return Number(rows[0]?.count ?? 0);
      }),
      countOrError('closet_outfit_favourites', () => prisma.closetOutfitFavourite.count({ where: { supabaseUserId: userId } })),
      countOrError('closet_outfit_week_plan', () => prisma.closetOutfitWeekPlanItem.count({ where: { supabaseUserId: userId } })),
    ]);

    // saved_outfits/closet_items/week_plan came back "relation does not
    // exist" — list every base table this connection can actually see, so we
    // can tell whether it's on the wrong schema or simply a different
    // database/Supabase project than the frontend's supabase-js client hits.
    let visibleTables: string[] | string;
    try {
      const rows = await prisma.$queryRaw<{ table_schema: string; table_name: string }[]>`
        SELECT table_schema, table_name FROM information_schema.tables
        WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY table_schema, table_name
      `;
      visibleTables = rows.map((r) => `${r.table_schema}.${r.table_name}`);
    } catch (error) {
      visibleTables = `information_schema error: ${error instanceof Error ? error.message : String(error)}`;
    }

    return sendSuccess(response, {
      savedOutfitsInCloud,
      closetItemsInCloud,
      weekPlanInCloud,
      closetOutfitFavouritesInCloud,
      closetOutfitWeekPlanInCloud,
      visibleTables,
    });
  })
);
