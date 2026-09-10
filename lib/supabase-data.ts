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
 * a normal read.
 *
 * Phase 3B1: routed through the dedicated get_saved_outfits_reconciliation_state
 * RPC (supabase/migrations/20260908000000_phase3b1_legacy_compatibility_bridge.sql)
 * instead of a direct `.from('saved_outfits').select('*')`. This is a
 * transport change only — the RPC derives the caller from auth.uid() itself
 * and returns the exact same active+tombstoned row set a direct select
 * already could (ordinary-read RLS on this table stays ownership-only, not
 * deleted_at-restricted — see that migration's Part 3 comment for why a
 * restrictive policy there would have broken legacy tombstone reactivation).
 * Kept as a dedicated RPC anyway for a schema-locked output contract and to
 * decouple this read from whatever the ordinary SELECT policy becomes in a
 * future phase.
 */
type SavedOutfitReconciliationRpcRow = {
  out_id: string;
  out_request_id: string;
  out_saved_at: string;
  out_input: SavedOutfit['input'];
  out_recommendation: SavedOutfit['recommendation'];
  out_sync_version: number;
  out_deleted_at: string | null;
};

export async function fetchSavedOutfitsForReconciliation(): Promise<SavedOutfitServerSnapshot[]> {
  const { data, error } = await supabase.rpc('get_saved_outfits_reconciliation_state');
  if (error || !data) return [];
  return (data as SavedOutfitReconciliationRpcRow[]).map((row) => ({
    id: row.out_id,
    requestId: row.out_request_id,
    savedAt: row.out_saved_at,
    input: row.out_input,
    recommendation: row.out_recommendation,
    syncVersion: row.out_sync_version,
    deletedAt: row.out_deleted_at,
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
 * See fetchSavedOutfitsForReconciliation's doc comment — same rationale,
 * routed through get_week_plan_reconciliation_state (Phase 3B1).
 */
type WeekPlanItemReconciliationRpcRow = {
  out_day_key: string;
  out_day_label: string;
  out_request_id: string;
  out_assigned_at: string;
  out_input: WeekPlannedOutfit['input'];
  out_recommendation: WeekPlannedOutfit['recommendation'];
  out_sync_version: number;
  out_deleted_at: string | null;
};

export async function fetchWeekPlanForReconciliation(): Promise<WeekPlanItemServerSnapshot[]> {
  const { data, error } = await supabase.rpc('get_week_plan_reconciliation_state');
  if (error || !data) return [];
  return (data as WeekPlanItemReconciliationRpcRow[]).map((row) => ({
    dayKey: row.out_day_key,
    dayLabel: row.out_day_label,
    requestId: row.out_request_id,
    assignedAt: row.out_assigned_at,
    input: row.out_input,
    recommendation: row.out_recommendation,
    syncVersion: row.out_sync_version,
    deletedAt: row.out_deleted_at,
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

// ── Phase 1A RPC wrappers (Phase 2B2 reconciliation execution) ─────────
// Thin, purely mechanical wrappers around the Phase 1A create/update/
// delete RPCs (supabase/migrations/20260907010000_phase1a_version_aware_rpcs.sql)
// — map JS params to the RPC's p_* arguments, map its out_* row back to a
// small structural result shape lib/reconciliation-executor.ts's
// DomainAdapter interface expects (status/version/deletedAt/content). No
// current caller — exists so the saved-outfits/week-plan reconciliation
// adapters have something real to call. The underlying RPCs themselves
// were already exhaustively verified against a disposable Postgres
// instance in Phase 1A/1B.1 (create/conflict/update/CAS/delete/
// reactivation/concurrent race) — this wrapper is unit-tested against
// response fixtures matching that already-proven shape, not re-verified
// against a live database by this file's own tests.

export type SavedOutfitRpcResult = {
  status: 'created' | 'create_conflict' | 'applied' | 'conflict' | 'not_found';
  version: number | null;
  deletedAt: string | null;
  content: SavedOutfit | null;
};

function normalizeSavedOutfitRpcRow(row: Record<string, unknown> | null): SavedOutfitRpcResult {
  const status = row?.out_status as SavedOutfitRpcResult['status'];
  if (!row || row.out_id === null || row.out_id === undefined) {
    return { status, version: null, deletedAt: null, content: null };
  }
  return {
    status,
    version: row.out_sync_version as number,
    deletedAt: (row.out_deleted_at as string | null) ?? null,
    content: {
      id: row.out_id as string,
      requestId: row.out_request_id as string,
      savedAt: row.out_saved_at as string,
      input: row.out_input as SavedOutfit['input'],
      recommendation: row.out_recommendation as SavedOutfit['recommendation'],
    },
  };
}

export async function createSavedOutfitViaRpc(outfit: SavedOutfit): Promise<SavedOutfitRpcResult> {
  const { data, error } = await supabase.rpc('create_saved_outfit', {
    p_id: outfit.id,
    p_request_id: outfit.requestId,
    p_saved_at: outfit.savedAt,
    p_input: outfit.input,
    p_recommendation: outfit.recommendation,
  });
  if (error) throw error;
  return normalizeSavedOutfitRpcRow(data?.[0] ?? null);
}

export async function updateSavedOutfitViaRpc(outfit: SavedOutfit, baseVersion: number): Promise<SavedOutfitRpcResult> {
  const { data, error } = await supabase.rpc('update_saved_outfit', {
    p_id: outfit.id,
    p_base_version: baseVersion,
    p_request_id: outfit.requestId,
    p_saved_at: outfit.savedAt,
    p_input: outfit.input,
    p_recommendation: outfit.recommendation,
  });
  if (error) throw error;
  return normalizeSavedOutfitRpcRow(data?.[0] ?? null);
}

export async function deleteSavedOutfitViaRpc(id: string, baseVersion: number): Promise<SavedOutfitRpcResult> {
  const { data, error } = await supabase.rpc('delete_saved_outfit', { p_id: id, p_base_version: baseVersion });
  if (error) throw error;
  return normalizeSavedOutfitRpcRow(data?.[0] ?? null);
}

export type WeekPlanItemRpcResult = {
  status: 'created' | 'create_conflict' | 'applied' | 'conflict' | 'not_found';
  version: number | null;
  deletedAt: string | null;
  content: WeekPlannedOutfit | null;
};

function normalizeWeekPlanItemRpcRow(row: Record<string, unknown> | null): WeekPlanItemRpcResult {
  const status = row?.out_status as WeekPlanItemRpcResult['status'];
  if (!row || row.out_day_key === null || row.out_day_key === undefined) {
    return { status, version: null, deletedAt: null, content: null };
  }
  return {
    status,
    version: row.out_sync_version as number,
    deletedAt: (row.out_deleted_at as string | null) ?? null,
    content: {
      dayKey: row.out_day_key as string,
      dayLabel: row.out_day_label as string,
      requestId: row.out_request_id as string,
      assignedAt: row.out_assigned_at as string,
      input: row.out_input as WeekPlannedOutfit['input'],
      recommendation: row.out_recommendation as WeekPlannedOutfit['recommendation'],
    },
  };
}

export async function createWeekPlanItemViaRpc(item: WeekPlannedOutfit): Promise<WeekPlanItemRpcResult> {
  const { data, error } = await supabase.rpc('create_week_plan_item', {
    p_day_key: item.dayKey,
    p_day_label: item.dayLabel,
    p_request_id: item.requestId,
    p_assigned_at: item.assignedAt,
    p_input: item.input,
    p_recommendation: item.recommendation,
  });
  if (error) throw error;
  return normalizeWeekPlanItemRpcRow(data?.[0] ?? null);
}

export async function updateWeekPlanItemViaRpc(item: WeekPlannedOutfit, baseVersion: number): Promise<WeekPlanItemRpcResult> {
  const { data, error } = await supabase.rpc('update_week_plan_item', {
    p_day_key: item.dayKey,
    p_base_version: baseVersion,
    p_day_label: item.dayLabel,
    p_request_id: item.requestId,
    p_assigned_at: item.assignedAt,
    p_input: item.input,
    p_recommendation: item.recommendation,
  });
  if (error) throw error;
  return normalizeWeekPlanItemRpcRow(data?.[0] ?? null);
}

export async function deleteWeekPlanItemViaRpc(dayKey: string, baseVersion: number): Promise<WeekPlanItemRpcResult> {
  const { data, error } = await supabase.rpc('delete_week_plan_item', { p_day_key: dayKey, p_base_version: baseVersion });
  if (error) throw error;
  return normalizeWeekPlanItemRpcRow(data?.[0] ?? null);
}
