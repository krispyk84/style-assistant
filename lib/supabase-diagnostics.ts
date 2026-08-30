import AsyncStorage from '@react-native-async-storage/async-storage';

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
  unfilteredSavedOutfitsCount: number | string;
  localSavedOutfitsCount: number | string;
}> {
  const { data: { session } } = await supabase.auth.getSession();

  const [savedOutfits, closetItems, weekPlan] = await Promise.all([
    checkTable('saved_outfits', 'user_id'),
    checkTable('closet_items', 'user_id'),
    checkTable('week_plan', 'user_id'),
  ]);

  // Exactly mirrors lib/supabase-data.ts's fetchSavedOutfitsFromSupabase() —
  // no explicit .eq('user_id', ...), relies purely on RLS — to check whether
  // that specific (unfiltered) query shape behaves differently from the
  // explicitly-filtered one above.
  let unfilteredSavedOutfitsCount: number | string;
  const { data, error } = await supabase.from('saved_outfits').select('*').order('saved_at', { ascending: false });
  if (error) {
    unfilteredSavedOutfitsCount = `error: ${error.code ?? ''} ${error.message}`.trim();
  } else {
    unfilteredSavedOutfitsCount = data?.length ?? 0;
  }

  const localRaw = await AsyncStorage.getItem('style-assistant/saved-outfits');
  let localSavedOutfitsCount: number | string = 0;
  if (localRaw) {
    try {
      const parsed = JSON.parse(localRaw);
      localSavedOutfitsCount = Array.isArray(parsed) ? parsed.length : 'stored value is not an array';
    } catch {
      localSavedOutfitsCount = 'stored value is not valid JSON';
    }
  }

  return {
    savedOutfits,
    closetItems,
    weekPlan,
    supabaseUserId: session?.user?.id ?? null,
    unfilteredSavedOutfitsCount,
    localSavedOutfitsCount,
  };
}
