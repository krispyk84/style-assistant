import { stripLegacySketchImageData } from '@/lib/outfit-utils';
import { supabase } from '@/lib/supabase';

// One-time cleanup for saved_outfits/week_plan rows saved before the backend
// stopped leaking the raw sketchImageData blob into outfit JSON responses
// (see outfits.repository.ts's mapToOutfitResponse) — those rows are stuck
// at ~800KB+ each until stripped, which is what made the full-table fetch
// that hydrates local storage on sign-in time out. Processes rows ONE AT A
// TIME (each single-row full fetch is fast — confirmed under 1s) rather than
// in one big batch, since fetching all of them at once is exactly the
// operation that times out.

type CleanupResult = { scanned: number; cleaned: number; errors: string[] };

async function cleanupTable(
  table: 'saved_outfits' | 'week_plan',
  idColumn: 'id' | 'day_key',
): Promise<CleanupResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return { scanned: 0, cleaned: 0, errors: ['No active Supabase session.'] };

  const { data: idRows, error: idError } = await supabase
    .from(table)
    .select(idColumn)
    .eq('user_id', userId);

  if (idError) return { scanned: 0, cleaned: 0, errors: [`Could not list rows: ${idError.message}`] };
  if (!idRows || idRows.length === 0) return { scanned: 0, cleaned: 0, errors: [] };

  let cleaned = 0;
  const errors: string[] = [];

  for (const row of idRows) {
    const rowId = (row as Record<string, string>)[idColumn];
    try {
      const { data: fullRow, error: fetchError } = await supabase
        .from(table)
        .select('recommendation')
        .eq(idColumn, rowId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !fullRow) {
        errors.push(`${rowId}: fetch failed — ${fetchError?.message ?? 'no row'}`);
        continue;
      }

      const recommendation = fullRow.recommendation as Record<string, unknown> | null;
      if (!recommendation || !('sketchImageData' in recommendation)) continue;

      const stripped = stripLegacySketchImageData(recommendation);
      const { error: updateError } = await supabase
        .from(table)
        .update({ recommendation: stripped })
        .eq(idColumn, rowId)
        .eq('user_id', userId);

      if (updateError) {
        errors.push(`${rowId}: update failed — ${updateError.message}`);
        continue;
      }
      cleaned += 1;
    } catch (error) {
      errors.push(`${rowId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { scanned: idRows.length, cleaned, errors };
}

export async function cleanupLegacySketchData(): Promise<{ savedOutfits: CleanupResult; weekPlan: CleanupResult }> {
  const savedOutfits = await cleanupTable('saved_outfits', 'id');
  const weekPlan = await cleanupTable('week_plan', 'day_key');
  return { savedOutfits, weekPlan };
}
