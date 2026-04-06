import { supabase } from '@/lib/supabase';
import type { ClosetItem } from '@/types/closet';
import type { SavedOutfit, WeekPlannedOutfit } from '@/types/style';

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
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
  await supabase.from('closet_items').upsert(toRow(item, userId));
}

export async function upsertManyClosetItemsToSupabase(items: ClosetItem[], explicitUserId?: string): Promise<void> {
  const userId = explicitUserId ?? await getCurrentUserId();
  if (!userId || items.length === 0) return;
  await supabase.from('closet_items').upsert(items.map((item) => toRow(item, userId)));
}

export async function deleteClosetItemFromSupabase(id: string): Promise<void> {
  await supabase.from('closet_items').delete().eq('id', id);
}

// ── Saved Outfits ──────────────────────────────────────────────────────────────

export async function fetchSavedOutfitsFromSupabase(): Promise<SavedOutfit[]> {
  const { data, error } = await supabase
    .from('saved_outfits')
    .select('*')
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

export async function upsertSavedOutfitToSupabase(outfit: SavedOutfit): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await supabase.from('saved_outfits').upsert({
    id: outfit.id,
    user_id: userId,
    request_id: outfit.requestId,
    saved_at: outfit.savedAt,
    input: outfit.input,
    recommendation: outfit.recommendation,
  });
}

export async function upsertManySavedOutfitsToSupabase(outfits: SavedOutfit[], explicitUserId?: string): Promise<void> {
  const userId = explicitUserId ?? await getCurrentUserId();
  if (!userId || outfits.length === 0) return;
  await supabase.from('saved_outfits').upsert(
    outfits.map((o) => ({
      id: o.id,
      user_id: userId,
      request_id: o.requestId,
      saved_at: o.savedAt,
      input: o.input,
      recommendation: o.recommendation,
    }))
  );
}

export async function deleteSavedOutfitFromSupabase(id: string): Promise<void> {
  await supabase.from('saved_outfits').delete().eq('id', id);
}

// ── Week Plan ──────────────────────────────────────────────────────────────────

export async function fetchWeekPlanFromSupabase(): Promise<WeekPlannedOutfit[]> {
  const { data, error } = await supabase
    .from('week_plan')
    .select('*')
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

export async function upsertWeekPlanItemToSupabase(item: WeekPlannedOutfit): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await supabase.from('week_plan').upsert({
    user_id: userId,
    day_key: item.dayKey,
    day_label: item.dayLabel,
    request_id: item.requestId,
    assigned_at: item.assignedAt,
    input: item.input,
    recommendation: item.recommendation,
  });
}

export async function upsertManyWeekPlanItemsToSupabase(items: WeekPlannedOutfit[], explicitUserId?: string): Promise<void> {
  const userId = explicitUserId ?? await getCurrentUserId();
  if (!userId || items.length === 0) return;
  await supabase.from('week_plan').upsert(
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
}

export async function deleteWeekPlanItemFromSupabase(dayKey: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await supabase.from('week_plan').delete().eq('day_key', dayKey).eq('user_id', userId);
}
