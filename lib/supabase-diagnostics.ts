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

// The full saved_outfits select (all columns, all rows) has repeatedly timed
// out at 10s while a count-only query on the same table stays instant —
// pointing at oversized row payloads rather than RLS/auth. This measures
// narrow-column fetch speed vs. actual row byte size directly, to confirm
// (or rule out) embedded base64 image data in older rows' recommendation
// JSONB column (pre-dating the switch to stable sketch URLs).
export async function measureSavedOutfitsPayload(): Promise<string> {
  const lines: string[] = [];
  const start = Date.now();

  try {
    const narrowStart = Date.now();
    const { data: narrowData, error: narrowError } = await supabase
      .from('saved_outfits')
      .select('id, saved_at')
      .order('saved_at', { ascending: false });
    if (narrowError) {
      lines.push(`narrow select (id, saved_at) — ERROR: ${narrowError.code ?? ''} ${narrowError.message}`.trim());
    } else {
      lines.push(`narrow select (id, saved_at), ${narrowData?.length ?? 0} rows — ${Date.now() - narrowStart}ms`);
    }
  } catch (error) {
    lines.push(`narrow select — ERROR: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const wideStart = Date.now();
    const { data: wideData, error: wideError } = await supabase
      .from('saved_outfits')
      .select('id, input, recommendation')
      .order('saved_at', { ascending: false })
      .limit(1);
    if (wideError) {
      lines.push(`single-row full row — ERROR: ${wideError.code ?? ''} ${wideError.message}`.trim());
    } else if (wideData && wideData.length > 0) {
      const row = wideData[0] as { input: unknown; recommendation: Record<string, unknown> | null };
      const recRaw = JSON.stringify(row.recommendation ?? {});
      const inputRaw = JSON.stringify(row.input ?? {});
      const sketchUrl = (row.recommendation as { sketchImageUrl?: string } | null)?.sketchImageUrl ?? '';
      lines.push(
        `single-row full fetch — ${Date.now() - wideStart}ms, recommendation ~${Math.round(recRaw.length / 1024)}KB, input ~${Math.round(inputRaw.length / 1024)}KB, sketchImageUrl starts with: ${sketchUrl.slice(0, 30) || '(none)'}`,
      );

      // Break recommendation down field-by-field to find what's actually bloated.
      if (row.recommendation) {
        const fieldSizes = Object.entries(row.recommendation)
          .map(([key, value]) => [key, JSON.stringify(value ?? null).length] as const)
          .sort((a, b) => b[1] - a[1]);
        lines.push(`recommendation field sizes (bytes): ${fieldSizes.map(([k, n]) => `${k}=${n}`).join(', ')}`);
      }
    } else {
      lines.push('single-row full fetch — 0 rows returned');
    }
  } catch (error) {
    lines.push(`single-row full fetch — ERROR: ${error instanceof Error ? error.message : String(error)}`);
  }

  lines.push(`total elapsed: ${Date.now() - start}ms`);
  return lines.join('\n');
}
