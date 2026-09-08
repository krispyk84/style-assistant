import { supabase } from '@/lib/supabase';
import type { ClosetItem } from '@/types/closet';
import type { SavedOutfit, WeekPlannedOutfit } from '@/types/style';

// Phase 2A/2B1 (sync redesign) — reconciliation-only snapshot shapes.
// Deliberately NOT part of types/style.ts's domain types: sync bookkeeping
// (syncVersion, deletedAt) must never leak into user-facing domain objects,
// matching the same separation Phase 1B established for local storage
// (docs/sync-phase2a-reconciliation-spec.md §F). Nothing consumes these yet
// — they exist for the pure decision engine's inputs, not any shipped flow.
export type SavedOutfitServerSnapshot = SavedOutfit & { syncVersion: number; deletedAt: string | null };
export type WeekPlanItemServerSnapshot = WeekPlannedOutfit & { syncVersion: number; deletedAt: string | null };

// ── Helpers ────────────────────────────────────────────────────────────────────

// Exported for lib/sync-metadata-storage.ts (Phase 1B.1) — that module
// needs the current session's user id to scope its storage key per-user,
// the same way every write in this file already scopes rows per-user.
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

// ── Closet Items ───────────────────────────────────────────────────────────────

function toRow(item: ClosetItem, userId: string) {
  return {
    id: item.id,
    user_id: userId,
    title: item.title,
    brand: item.brand,
    size: item.size,
    category: item.category,
    uploaded_image_url: item.uploadedImageUrl ?? null,
    sketch_image_url: item.sketchImageUrl ?? null,
    sketch_status: item.sketchStatus,
    saved_at: item.savedAt,
    subcategory: item.subcategory ?? null,
    primary_color: item.primaryColor ?? null,
    color_family: item.colorFamily ?? null,
    material: item.material ?? null,
    formality: item.formality ?? null,
    silhouette: item.silhouette ?? null,
    season: item.season ?? null,
    weight: item.weight ?? null,
    pattern: item.pattern ?? null,
    notes: item.notes ?? null,
    fit_status: item.fitStatus ?? null,
    anchor_to_outfit_count: item.anchorToOutfitCount ?? 0,
    matched_to_recommendation_count: item.matchedToRecommendationCount ?? 0,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(row: any): ClosetItem {
  return {
    id: row.id,
    title: row.title,
    brand: row.brand,
    size: row.size,
    category: row.category,
    uploadedImageUrl: row.uploaded_image_url,
    sketchImageUrl: row.sketch_image_url,
    sketchStatus: row.sketch_status ?? 'pending',
    savedAt: row.saved_at,
    subcategory: row.subcategory,
    primaryColor: row.primary_color,
    colorFamily: row.color_family,
    material: row.material,
    formality: row.formality,
    silhouette: row.silhouette,
    season: row.season,
    weight: row.weight,
    pattern: row.pattern,
    notes: row.notes,
    fitStatus: row.fit_status,
    anchorToOutfitCount: row.anchor_to_outfit_count ?? 0,
    matchedToRecommendationCount: row.matched_to_recommendation_count ?? 0,
  };
}

export async function fetchClosetItemsFromSupabase(): Promise<ClosetItem[]> {
  const { data, error } = await supabase
    .from('closet_items')
    .select('*')
    .order('saved_at', { ascending: false });
  if (error || !data) return [];
  return data.map(fromRow);
}

export async function upsertClosetItemToSupabase(item: ClosetItem): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const { error } = await supabase.from('closet_items').upsert(toRow(item, userId));
  if (error) throw error;
}

export async function upsertManyClosetItemsToSupabase(items: ClosetItem[], explicitUserId?: string): Promise<void> {
  const userId = explicitUserId ?? await getCurrentUserId();
  if (!userId || items.length === 0) return;
  const { error } = await supabase.from('closet_items').upsert(items.map((item) => toRow(item, userId)));
  if (error) throw error;
}

export async function deleteClosetItemFromSupabase(id: string): Promise<void> {
  const { error } = await supabase.from('closet_items').delete().eq('id', id);
  if (error) throw error;
}

// ── Saved Outfits ──────────────────────────────────────────────────────────────

export async function fetchSavedOutfitsFromSupabase(): Promise<SavedOutfit[]> {
  // Phase 2B1 fix: this ordinary read previously had no deleted_at filter at
  // all — nothing in RLS or the query itself excluded a tombstoned row, so
  // if one ever existed it would have shown up here as if live. Nothing sets
  // deleted_at through the currently-installed app yet (only the unused
  // Phase 1A RPCs can), so this was latent, not yet manifested — closed now,
  // before reconciliation makes tombstones real.
  const { data, error } = await supabase
    .from('saved_outfits')
    .select('*')
    .is('deleted_at', null)
    .order('saved_at', { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    requestId: row.request_id,
    savedAt: row.saved_at,
    input: row.input,
    recommendation: row.recommendation,
  }));
}

/**
 * Reconciliation-only: includes tombstoned rows and sync_version/deleted_at.
 * Never use this for an ordinary UI list — see fetchSavedOutfitsFromSupabase
 * above, which filters deleted_at specifically so tombstones never leak into
 * a normal read. No current call site; exists for the (not yet implemented)
 * reconciliation engine's server-state input.
 */
export async function fetchSavedOutfitsForReconciliation(): Promise<SavedOutfitServerSnapshot[]> {
  const { data, error } = await supabase
    .from('saved_outfits')
    .select('*');
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    requestId: row.request_id,
    savedAt: row.saved_at,
    input: row.input,
    recommendation: row.recommendation,
    syncVersion: row.sync_version,
    deletedAt: row.deleted_at,
  }));
}

export async function upsertSavedOutfitToSupabase(outfit: SavedOutfit): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const { error } = await supabase.from('saved_outfits').upsert({
    id: outfit.id,
    user_id: userId,
    request_id: outfit.requestId,
    saved_at: outfit.savedAt,
    input: outfit.input,
    recommendation: outfit.recommendation,
  });
  if (error) throw error;
}

export async function upsertManySavedOutfitsToSupabase(outfits: SavedOutfit[], explicitUserId?: string): Promise<void> {
  const userId = explicitUserId ?? await getCurrentUserId();
  if (!userId || outfits.length === 0) return;
  const { error } = await supabase.from('saved_outfits').upsert(
    outfits.map((o) => ({
      id: o.id,
      user_id: userId,
      request_id: o.requestId,
      saved_at: o.savedAt,
      input: o.input,
      recommendation: o.recommendation,
    }))
  );
  if (error) throw error;
}

export async function deleteSavedOutfitFromSupabase(id: string): Promise<void> {
  const { error } = await supabase.from('saved_outfits').delete().eq('id', id);
  if (error) throw error;
}

// ── Week Plan ──────────────────────────────────────────────────────────────────

export async function fetchWeekPlanFromSupabase(): Promise<WeekPlannedOutfit[]> {
  // Phase 2B1 fix: same latent gap as fetchSavedOutfitsFromSupabase — no
  // deleted_at filter existed here at all before this.
  const { data, error } = await supabase
    .from('week_plan')
    .select('*')
    .is('deleted_at', null)
    .order('day_key', { ascending: true });
  if (error || !data) return [];
  return data.map((row) => ({
    dayKey: row.day_key,
    dayLabel: row.day_label,
    requestId: row.request_id,
    assignedAt: row.assigned_at,
    input: row.input,
    recommendation: row.recommendation,
  }));
}

/**
 * Reconciliation-only: includes tombstoned rows and sync_version/deleted_at.
 * See fetchSavedOutfitsForReconciliation's doc comment — same rationale, no
 * current call site.
 */
export async function fetchWeekPlanForReconciliation(): Promise<WeekPlanItemServerSnapshot[]> {
  const { data, error } = await supabase
    .from('week_plan')
    .select('*');
  if (error || !data) return [];
  return data.map((row) => ({
    dayKey: row.day_key,
    dayLabel: row.day_label,
    requestId: row.request_id,
    assignedAt: row.assigned_at,
    input: row.input,
    recommendation: row.recommendation,
    syncVersion: row.sync_version,
    deletedAt: row.deleted_at,
  }));
}

export async function upsertWeekPlanItemToSupabase(item: WeekPlannedOutfit): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const { error } = await supabase.from('week_plan').upsert({
    user_id: userId,
    day_key: item.dayKey,
    day_label: item.dayLabel,
    request_id: item.requestId,
    assigned_at: item.assignedAt,
    input: item.input,
    recommendation: item.recommendation,
  });
  if (error) throw error;
}

export async function upsertManyWeekPlanItemsToSupabase(items: WeekPlannedOutfit[], explicitUserId?: string): Promise<void> {
  const userId = explicitUserId ?? await getCurrentUserId();
  if (!userId || items.length === 0) return;
  const { error } = await supabase.from('week_plan').upsert(
    items.map((item) => ({
      user_id: userId,
      day_key: item.dayKey,
      day_label: item.dayLabel,
      request_id: item.requestId,
      assigned_at: item.assignedAt,
      input: item.input,
      recommendation: item.recommendation,
    }))
  );
  if (error) throw error;
}

export async function deleteWeekPlanItemFromSupabase(dayKey: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const { error } = await supabase.from('week_plan').delete().eq('day_key', dayKey).eq('user_id', userId);
  if (error) throw error;
}
