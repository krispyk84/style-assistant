import { supabase } from '@/lib/supabase';

// Checks the frontend's OWN Supabase project directly (same client + project
// lib/supabase-data.ts already uses) rather than going through the backend —
// the backend's DATABASE_URL turned out to be a different database entirely
// (its Prisma-managed tables only; saved_outfits/closet_items/week_plan don't
// exist there), so any real answer about this data has to come from here.
// fetchSavedOutfitsFromSupabase() et al. swallow every error into `[]`; this
// surfaces the raw PostgREST error/count instead so we can actually diagnose.

export type TableCheckResult = { count: number | null; error: string | null };

async function checkTable(table: string, userIdColumn: string): Promise<TableCheckResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return { count: null, error: 'No active Supabase session.' };

  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(userIdColumn, userId);

  return { count: count ?? null, error: error ? `${error.code ?? ''} ${error.message}`.trim() : null };
}

export async function checkSupabaseTablesDirectly(): Promise<{
  savedOutfits: TableCheckResult;
  closetItems: TableCheckResult;
  weekPlan: TableCheckResult;
  supabaseUserId: string | null;
}> {
  const { data: { session } } = await supabase.auth.getSession();

  const [savedOutfits, closetItems, weekPlan] = await Promise.all([
    checkTable('saved_outfits', 'user_id'),
    checkTable('closet_items', 'user_id'),
    checkTable('week_plan', 'user_id'),
  ]);

  return { savedOutfits, closetItems, weekPlan, supabaseUserId: session?.user?.id ?? null };
}
