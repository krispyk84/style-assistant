import AsyncStorage from '@react-native-async-storage/async-storage';

import { logAuthEvent } from '@/lib/auth-event-log';
import {
  fetchClosetOutfitFavouritesFromBackend,
  fetchClosetOutfitWeekPlanFromBackend,
  upsertManyClosetOutfitFavouritesToBackend,
  upsertManyClosetOutfitWeekPlanItemsToBackend,
} from '@/lib/closet-outfit-sync';
import {
  fetchClosetItemsFromSupabase,
  upsertManyClosetItemsToSupabase,
  fetchSavedOutfitsFromSupabase,
  upsertManySavedOutfitsToSupabase,
  fetchWeekPlanFromSupabase,
  upsertManyWeekPlanItemsToSupabase,
} from '@/lib/supabase-data';

const CLOSET_KEY = 'style-assistant/closet-items';
const OUTFITS_KEY = 'style-assistant/saved-outfits';
const WEEK_KEY = 'style-assistant/week-plan';
const SESSION_KEY = 'style-assistant/session';
const CLOSET_OUTFIT_FAVOURITES_KEY = 'style-assistant/closet-outfit-favourites';
const CLOSET_OUTFIT_WEEK_PLAN_KEY = 'style-assistant/closet-outfit-week-plan';

// Every other AsyncStorage key any part of the app writes to. None of these
// are namespaced by user id, so without this sweep they silently carry over
// to whichever account signs in next on the same device — e.g. Looks
// "Favourites" showing one account's saved closet outfits inside a
// different account. Keep this in sync with every lib/*-storage.ts file
// that calls AsyncStorage.setItem — a new local cache added there needs its
// key added here too, or it leaks the same way.
const OTHER_PER_USER_KEYS = [
  'style-assistant/match-feedback',           // match-feedback-storage.ts
  'style-assistant/recommendation-feedback',  // recommendation-feedback-storage.ts
  'style-assistant/trip-draft',               // trip-draft-storage.ts
  'style-assistant/trip-outfits',             // trip-outfits-storage.ts
  'style-assistant/app-settings',             // app-settings-storage.ts
  'style-assistant/weather-context',          // weather-storage.ts — not identity-bound, but harmless to clear (just refetches)
];

/** Wipes all per-user local data. Call on sign-out so the next user starts clean. */
export async function clearAllLocalUserData(): Promise<void> {
  await Promise.all(
    [
      CLOSET_KEY, OUTFITS_KEY, WEEK_KEY, SESSION_KEY,
      CLOSET_OUTFIT_FAVOURITES_KEY, CLOSET_OUTFIT_WEEK_PLAN_KEY,
      ...OTHER_PER_USER_KEYS,
    ].map((key) => AsyncStorage.removeItem(key)),
  );
}

const ENTITY_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

/**
 * Called once on SIGNED_IN. Pass the userId from the auth event to avoid
 * a timing race with supabase.auth.getUser().
 *
 * Strategy per entity:
 *   - Cloud has data  → pull to local (cloud wins, covers multi-device sync)
 *   - Cloud is empty  → push local to cloud (one-time migration for existing data)
 *
 * Each entity is bounded by a timeout (a hung network call must not block
 * the others — Promise.all only settles once every entity has, so one
 * indefinitely-pending fetch would silently prevent the rest from ever
 * being reported) and logs its own result the moment it settles, via
 * lib/auth-event-log.ts, rather than waiting for every entity to finish —
 * that way a single slow/hung entity doesn't hide the others' outcomes.
 */
export async function syncUserDataOnSignIn(userId: string): Promise<string[]> {
  void logAuthEvent('sync: started', userId);
  return Promise.all([
    syncEntity('closet', CLOSET_KEY, fetchClosetItemsFromSupabase, (items) => upsertManyClosetItemsToSupabase(items, userId), userId),
    syncEntity('saved-outfits', OUTFITS_KEY, fetchSavedOutfitsFromSupabase, (items) => upsertManySavedOutfitsToSupabase(items, userId), userId),
    syncEntity('week-plan', WEEK_KEY, fetchWeekPlanFromSupabase, (items) => upsertManyWeekPlanItemsToSupabase(items, userId), userId),
    syncEntity('closet-outfit-favourites', CLOSET_OUTFIT_FAVOURITES_KEY, fetchClosetOutfitFavouritesFromBackend, upsertManyClosetOutfitFavouritesToBackend, userId),
    syncEntity('closet-outfit-week-plan', CLOSET_OUTFIT_WEEK_PLAN_KEY, fetchClosetOutfitWeekPlanFromBackend, upsertManyClosetOutfitWeekPlanItemsToBackend, userId),
  ]);
}

async function syncEntity<T>(
  label: string,
  storageKey: string,
  fetchFromCloud: () => Promise<T[]>,
  pushToCloud: (items: T[]) => Promise<void>,
  userId: string,
): Promise<string> {
  let result: string;
  try {
    const cloudItems = await withTimeout(fetchFromCloud(), ENTITY_TIMEOUT_MS, `${label} fetch`);

    if (cloudItems.length > 0) {
      await AsyncStorage.setItem(storageKey, JSON.stringify(cloudItems));
      result = `${label}: pulled ${cloudItems.length} from cloud`;
    } else {
      const localRaw = await AsyncStorage.getItem(storageKey);
      if (!localRaw) {
        result = `${label}: cloud empty, no local data either`;
      } else {
        const localItems = JSON.parse(localRaw) as T[];
        if (Array.isArray(localItems) && localItems.length > 0) {
          await withTimeout(pushToCloud(localItems), ENTITY_TIMEOUT_MS, `${label} push`);
          result = `${label}: cloud empty, pushed ${localItems.length} local items to cloud`;
        } else {
          result = `${label}: cloud empty, local empty`;
        }
      }
    }
  } catch (error) {
    result = `${label}: ERROR — ${error instanceof Error ? error.message : String(error)}`;
  }
  void logAuthEvent(`sync: ${result}`, userId);
  return result;
}
