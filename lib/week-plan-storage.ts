import AsyncStorage from '@react-native-async-storage/async-storage';

import { appConfig } from '@/constants/config';
import { recordError } from '@/lib/crashlytics';
import { stripLegacySketchImageData } from '@/lib/outfit-utils';
import {
  deleteWeekPlanItemFromSupabase,
  upsertWeekPlanItemToSupabase,
} from '@/lib/supabase-data';
import { markActive, markDeleted } from '@/lib/sync-metadata-storage';
import type { CreateLookInput, LookRecommendation } from '@/types/look-request';
import type { WeekPlannedOutfit } from '@/types/style';

const STORAGE_KEY = 'style-assistant/week-plan';

function getLocalDayKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isFutureWeekDay(dayKey: string) {
  const validDayKeys = new Set(getNextSevenDays().map((day) => day.dayKey));
  return validDayKeys.has(dayKey);
}

function buildStableSketchUri(requestId: string, tier: LookRecommendation['tier']) {
  if (appConfig.useMockServices || !appConfig.apiBaseUrl) {
    return null;
  }

  return `${appConfig.apiBaseUrl}/outfits/${requestId}/sketch/${tier}`;
}

function normalizeWeekPlannedOutfit(item: WeekPlannedOutfit): WeekPlannedOutfit {
  return {
    ...item,
    recommendation: {
      ...stripLegacySketchImageData(item.recommendation),
      sketchImageUrl:
        item.recommendation.sketchStatus === 'ready'
          ? buildStableSketchUri(item.requestId, item.recommendation.tier)
          : item.recommendation.sketchImageUrl ?? null,
    },
  };
}

export function getNextSevenDays() {
  const baseDate = new Date();
  const days = [];

  for (let offset = 0; offset <= 7; offset += 1) {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + offset);

    days.push({
      dayKey: getLocalDayKey(date),
      dayLabel: date.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }),
    });
  }

  return days;
}

export async function loadWeekPlan(): Promise<WeekPlannedOutfit[]> {
  const rawValue = await AsyncStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (!Array.isArray(parsed)) {
      return [];
    }

    const normalizedItems = parsed
      .filter(
        (item): item is WeekPlannedOutfit =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.dayKey === 'string' &&
          typeof item.dayLabel === 'string' &&
          typeof item.requestId === 'string' &&
          typeof item.assignedAt === 'string' &&
          typeof item.input === 'object' &&
          item.input !== null &&
          typeof item.recommendation === 'object' &&
          item.recommendation !== null
      )
      .map(normalizeWeekPlannedOutfit)
      .filter((item) => isFutureWeekDay(item.dayKey))
      .sort((left, right) => left.dayKey.localeCompare(right.dayKey));

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedItems));
    return normalizedItems;
  } catch {
    return [];
  }
}

export async function assignOutfitToWeekDay(
  dayKey: string,
  dayLabel: string,
  input: CreateLookInput,
  recommendation: LookRecommendation,
  requestId: string
) {
  const currentItems = await loadWeekPlan();
  const nextItem = normalizeWeekPlannedOutfit({
    dayKey,
    dayLabel,
    requestId,
    assignedAt: new Date().toISOString(),
    input,
    recommendation,
  });
  const nextItems = [nextItem, ...currentItems.filter((item) => item.dayKey !== dayKey)];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
  void upsertWeekPlanItemToSupabase(nextItem).catch((error) => recordError(error, 'week_plan_assign_upsert'));
  // Phase 1B.1: awaited, not fire-and-forget, and not caught here — see
  // saved-outfits-storage.ts's saveSavedOutfit for why (reliably clears a
  // stale tombstone on the deliberate reassign-after-removeWeekPlan case;
  // surfaces a genuine failure instead of silently diverging). Not touched
  // by loadWeekPlan's automatic day-rollover pruning above — that's
  // staleness, not an intentional deletion, and must never create a
  // tombstone.
  await markActive('week-plan', dayKey);
  return nextItem;
}

export async function removeWeekPlan(dayKey: string) {
  // Phase 1B.1: tombstone persisted FIRST, awaited, uncaught — see
  // saved-outfits-storage.ts's deleteSavedOutfit for the full rationale.
  await markDeleted('week-plan', dayKey);

  const currentItems = await loadWeekPlan();
  const nextItems = currentItems.filter((item) => item.dayKey !== dayKey);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
  void deleteWeekPlanItemFromSupabase(dayKey).catch((error) => recordError(error, 'week_plan_remove'));
  return nextItems;
}

export async function replaceWeekPlan(items: WeekPlannedOutfit[]) {
  const normalizedItems = items.map(normalizeWeekPlannedOutfit).filter((item) => isFutureWeekDay(item.dayKey));
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedItems));
  return normalizedItems;
}

// ── Phase 2B2 reconciliation-only single-record helpers ────────────────
// See saved-outfits-storage.ts's equivalent block for the rationale: pure
// local read-modify-write only, no legacy cloud write, no metadata touch.
// Deliberately skips isFutureWeekDay filtering — reconciliation must be
// able to read/write/remove any dayKey the server knows about, not just
// ones inside the display window (that filtering is a UI-list concern
// specific to loadWeekPlan). No current caller.

export async function readOneWeekPlanItemLocal(dayKey: string): Promise<WeekPlannedOutfit | null> {
  const rawValue = await AsyncStorage.getItem(STORAGE_KEY);
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return null;
    const match = parsed.find((item) => item && typeof item === 'object' && item.dayKey === dayKey);
    return match ? normalizeWeekPlannedOutfit(match as WeekPlannedOutfit) : null;
  } catch {
    return null;
  }
}

async function readAllWeekPlanItemsRaw(): Promise<WeekPlannedOutfit[]> {
  const rawValue = await AsyncStorage.getItem(STORAGE_KEY);
  if (!rawValue) return [];
  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? (parsed as WeekPlannedOutfit[]) : [];
  } catch {
    return [];
  }
}

export async function writeOneWeekPlanItemLocal(content: WeekPlannedOutfit): Promise<void> {
  const all = await readAllWeekPlanItemsRaw();
  const next = [content, ...all.filter((item) => item.dayKey !== content.dayKey)];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export async function removeOneWeekPlanItemLocal(dayKey: string): Promise<void> {
  const all = await readAllWeekPlanItemsRaw();
  const next = all.filter((item) => item.dayKey !== dayKey);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
