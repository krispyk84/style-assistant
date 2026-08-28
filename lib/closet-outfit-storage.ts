import AsyncStorage from '@react-native-async-storage/async-storage';

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
  return next;
}

export async function deleteSavedClosetOutfit(id: string) {
  const current = await loadSavedClosetOutfits();
  const nextList = current.filter((item) => item.id !== id);
  await AsyncStorage.setItem(FAVOURITES_KEY, JSON.stringify(nextList));
  return nextList;
}

// ── Week plan ────────────────────────────────────────────────────────────────

function isFutureWeekDay(dayKey: string) {
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
  return next;
}

export async function removeClosetWeekPlanDay(dayKey: string) {
  const current = await loadClosetWeekPlan();
  const nextItems = current.filter((item) => item.dayKey !== dayKey);
  await AsyncStorage.setItem(WEEK_PLAN_KEY, JSON.stringify(nextItems));
  return nextItems;
}
