import AsyncStorage from '@react-native-async-storage/async-storage';

import { recordError } from '@/lib/crashlytics';
import { markActive, markDeleted } from '@/lib/sync-metadata-storage';
import { getNextSevenDays } from '@/lib/week-plan-storage';
import type { ClosetGeneratedOutfit } from '@/types/api';
import type { LookTierSlug } from '@/types/look-request';

// Favourites and week-plan storage for outfits built entirely from the closet
// (Generate 5 Outfits). Deliberately NOT layered onto lib/saved-outfits-storage.ts
// or lib/week-plan-storage.ts — those reconstruct a "stable" sketch URL from
// requestId+tier via the tier-sketch backend route on every load, which would
// silently replace a closet outfit's real (already-durable) sketch URL with a
// broken one. Closet-generated sketches are already stored durably (DB-backed,
// same as closet item sketches), so no such reconstruction is needed here.

export type SavedClosetOutfit = {
  id: string;
  formality: LookTierSlug;
  outfit: ClosetGeneratedOutfit;
  savedAt: string;
};

export type ClosetWeekPlanItem = {
  dayKey: string;
  dayLabel: string;
  formality: LookTierSlug;
  outfit: ClosetGeneratedOutfit;
  assignedAt: string;
};

const FAVOURITES_KEY = 'style-assistant/closet-outfit-favourites';
const WEEK_PLAN_KEY = 'style-assistant/closet-outfit-week-plan';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// ── Favourites ───────────────────────────────────────────────────────────────

export async function loadSavedClosetOutfits(): Promise<SavedClosetOutfit[]> {
  const rawValue = await AsyncStorage.getItem(FAVOURITES_KEY);
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is SavedClosetOutfit =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        typeof item.formality === 'string' &&
        typeof item.savedAt === 'string' &&
        isRecord(item.outfit)
      )
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt));
  } catch {
    return [];
  }
}

export async function saveClosetOutfitToFavourites(formality: LookTierSlug, outfit: ClosetGeneratedOutfit) {
  const current = await loadSavedClosetOutfits();
  const id = outfit.id;
  const next: SavedClosetOutfit = { id, formality, outfit, savedAt: new Date().toISOString() };
  const nextList = [next, ...current.filter((item) => item.id !== id)];
  await AsyncStorage.setItem(FAVOURITES_KEY, JSON.stringify(nextList));
  // Phase 1B.1: awaited, not fire-and-forget, and not caught here — see
  // saved-outfits-storage.ts's saveSavedOutfit for the full rationale.
  await markActive('closet-outfit-favourites', id);
  // Phase 3A3: closet-outfit-favourites' ONLY server mutation architecture
  // is now the version-aware reconciliation engine/executor, mediated
  // through our own backend rather than direct Supabase — the legacy
  // unconditional upsertClosetOutfitFavouriteToBackend call that used to run
  // here is gone (running both would be the uncoordinated dual write §M.1
  // forbids). Local persist above already completed the user-visible
  // favourite; this is a best-effort trailing sync — failure leaves
  // isDirty=true (already durable from markActive above) for the next
  // reconciliation pass to retry. Dynamic import avoids a real module cycle:
  // closet-outfit-favourites-reconciliation -> reconciliation-adapters ->
  // this file. closet-outfit-WEEK-PLAN below is untouched and remains
  // entirely legacy.
  void import('@/lib/closet-outfit-favourites-reconciliation')
    .then(({ reconcileClosetOutfitFavourites }) => reconcileClosetOutfitFavourites())
    .catch((error) => recordError(error, 'closet_outfit_favourite_reconcile_after_save'));
  return next;
}

export async function deleteSavedClosetOutfit(id: string) {
  // Phase 1B.1: tombstone persisted FIRST, awaited, uncaught — see
  // saved-outfits-storage.ts's deleteSavedOutfit for the full rationale.
  await markDeleted('closet-outfit-favourites', id);

  const current = await loadSavedClosetOutfits();
  const nextList = current.filter((item) => item.id !== id);
  await AsyncStorage.setItem(FAVOURITES_KEY, JSON.stringify(nextList));
  // Phase 3A3: same replacement as saveClosetOutfitToFavourites above — the
  // legacy unconditional physical deleteClosetOutfitFavouriteFromBackend
  // call is gone; the version-aware reconciliation engine/executor now owns
  // server-side deletion (CAS soft delete for acknowledged favourites,
  // compatibility-era deferral for unknown-ancestry legacy ones).
  void import('@/lib/closet-outfit-favourites-reconciliation')
    .then(({ reconcileClosetOutfitFavourites }) => reconcileClosetOutfitFavourites())
    .catch((error) => recordError(error, 'closet_outfit_favourite_reconcile_after_delete'));
  return nextList;
}

// ── Week plan ────────────────────────────────────────────────────────────────

/**
 * Exported for lib/closet-outfit-week-plan-reconciliation.ts (Phase 3A4):
 * the same retention-window `includeId` filter lib/week-plan-storage.ts's
 * own `isFutureWeekDay` provides for ordinary week-plan (Phase 3A2 §O.2) —
 * without it, a day that rolled out of the window as pure local housekeeping
 * (never a tombstone, never markDeleted) but that the server or a leftover
 * metadata entry still remembers would look like ordinary internal drift to
 * the decision engine and get silently re-downloaded forever.
 */
export function isFutureWeekDay(dayKey: string) {
  const validDayKeys = new Set(getNextSevenDays().map((day) => day.dayKey));
  return validDayKeys.has(dayKey);
}

export async function loadClosetWeekPlan(): Promise<ClosetWeekPlanItem[]> {
  const rawValue = await AsyncStorage.getItem(WEEK_PLAN_KEY);
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    const items = parsed
      .filter((item): item is ClosetWeekPlanItem =>
        isRecord(item) &&
        typeof item.dayKey === 'string' &&
        typeof item.dayLabel === 'string' &&
        typeof item.formality === 'string' &&
        typeof item.assignedAt === 'string' &&
        isRecord(item.outfit)
      )
      .filter((item) => isFutureWeekDay(item.dayKey))
      .sort((left, right) => left.dayKey.localeCompare(right.dayKey));

    await AsyncStorage.setItem(WEEK_PLAN_KEY, JSON.stringify(items));
    return items;
  } catch {
    return [];
  }
}

export async function assignClosetOutfitToWeekDay(
  dayKey: string,
  dayLabel: string,
  formality: LookTierSlug,
  outfit: ClosetGeneratedOutfit,
) {
  const current = await loadClosetWeekPlan();
  const next: ClosetWeekPlanItem = { dayKey, dayLabel, formality, outfit, assignedAt: new Date().toISOString() };
  const nextItems = [next, ...current.filter((item) => item.dayKey !== dayKey)];
  await AsyncStorage.setItem(WEEK_PLAN_KEY, JSON.stringify(nextItems));
  // Phase 1B.1: awaited, not fire-and-forget, and not caught here — see
  // saved-outfits-storage.ts's saveSavedOutfit for the full rationale. Not
  // touched by loadClosetWeekPlan's automatic day-rollover pruning above
  // (staleness, not an intentional deletion).
  await markActive('closet-outfit-week-plan', dayKey);
  // Phase 3A4: closet-outfit-week-plan's ONLY server mutation architecture
  // is now the version-aware reconciliation engine/executor, mediated
  // through our own backend — the legacy unconditional
  // upsertClosetOutfitWeekPlanItemToBackend call that used to run here is
  // gone (running both would be the uncoordinated dual write §M.1 forbids).
  // Local persist above already completed the user-visible assignment; this
  // is a best-effort trailing sync — failure leaves isDirty=true (already
  // durable from markActive above) for the next reconciliation pass to
  // retry. Dynamic import avoids a real module cycle:
  // closet-outfit-week-plan-reconciliation -> reconciliation-adapters ->
  // this file.
  void import('@/lib/closet-outfit-week-plan-reconciliation')
    .then(({ reconcileClosetOutfitWeekPlan }) => reconcileClosetOutfitWeekPlan())
    .catch((error) => recordError(error, 'closet_outfit_week_plan_reconcile_after_assign'));
  return next;
}

export async function removeClosetWeekPlanDay(dayKey: string) {
  // Phase 1B.1: tombstone persisted FIRST, awaited, uncaught — see
  // saved-outfits-storage.ts's deleteSavedOutfit for the full rationale.
  await markDeleted('closet-outfit-week-plan', dayKey);

  const current = await loadClosetWeekPlan();
  const nextItems = current.filter((item) => item.dayKey !== dayKey);
  await AsyncStorage.setItem(WEEK_PLAN_KEY, JSON.stringify(nextItems));
  // Phase 3A4: same replacement as assignClosetOutfitToWeekDay above — the
  // legacy unconditional physical deleteClosetOutfitWeekPlanItemFromBackend
  // call is gone; the version-aware reconciliation engine/executor now owns
  // server-side deletion. This is a genuine, deliberate user clear —
  // distinct from loadClosetWeekPlan's automatic day-rollover pruning
  // above, which never calls markDeleted and must never reach this function.
  void import('@/lib/closet-outfit-week-plan-reconciliation')
    .then(({ reconcileClosetOutfitWeekPlan }) => reconcileClosetOutfitWeekPlan())
    .catch((error) => recordError(error, 'closet_outfit_week_plan_reconcile_after_remove'));
  return nextItems;
}

// ── Phase 2B2 reconciliation-only single-record helpers ────────────────
// See saved-outfits-storage.ts's equivalent block for the rationale: pure
// local read-modify-write only, no legacy cloud write, no metadata touch,
// no isFutureWeekDay filtering for the week-plan sub-domain. No current
// caller.

export async function readOneSavedClosetOutfitLocal(id: string): Promise<SavedClosetOutfit | null> {
  const all = await loadSavedClosetOutfits();
  return all.find((item) => item.id === id) ?? null;
}

export async function writeOneSavedClosetOutfitLocal(content: SavedClosetOutfit): Promise<void> {
  const all = await loadSavedClosetOutfits();
  const next = [content, ...all.filter((item) => item.id !== content.id)];
  await AsyncStorage.setItem(FAVOURITES_KEY, JSON.stringify(next));
}

export async function removeOneSavedClosetOutfitLocal(id: string): Promise<void> {
  const all = await loadSavedClosetOutfits();
  const next = all.filter((item) => item.id !== id);
  await AsyncStorage.setItem(FAVOURITES_KEY, JSON.stringify(next));
}

async function readAllClosetWeekPlanItemsRaw(): Promise<ClosetWeekPlanItem[]> {
  const rawValue = await AsyncStorage.getItem(WEEK_PLAN_KEY);
  if (!rawValue) return [];
  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? (parsed as ClosetWeekPlanItem[]) : [];
  } catch {
    return [];
  }
}

export async function readOneClosetWeekPlanItemLocal(dayKey: string): Promise<ClosetWeekPlanItem | null> {
  const all = await readAllClosetWeekPlanItemsRaw();
  return all.find((item) => item.dayKey === dayKey) ?? null;
}

export async function writeOneClosetWeekPlanItemLocal(content: ClosetWeekPlanItem): Promise<void> {
  const all = await readAllClosetWeekPlanItemsRaw();
  const next = [content, ...all.filter((item) => item.dayKey !== content.dayKey)];
  await AsyncStorage.setItem(WEEK_PLAN_KEY, JSON.stringify(next));
}

export async function removeOneClosetWeekPlanItemLocal(dayKey: string): Promise<void> {
  const all = await readAllClosetWeekPlanItemsRaw();
  const next = all.filter((item) => item.dayKey !== dayKey);
  await AsyncStorage.setItem(WEEK_PLAN_KEY, JSON.stringify(next));
}
