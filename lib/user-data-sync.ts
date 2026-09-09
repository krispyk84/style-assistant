import AsyncStorage from '@react-native-async-storage/async-storage';

import { logAuthEvent } from '@/lib/auth-event-log';
import { withTimeout } from '@/lib/with-timeout';
import {
  fetchClosetOutfitWeekPlanFromBackend,
  upsertManyClosetOutfitWeekPlanItemsToBackend,
} from '@/lib/closet-outfit-sync';
import {
  fetchClosetItemsFromSupabase,
  upsertManyClosetItemsToSupabase,
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
  // sync-metadata-storage.ts's keys (style-assistant/sync-metadata/<userId>)
  // are DELIBERATELY NOT listed here (Phase 1B.1). Phase 1B originally used
  // one global key and wiped it here like everything else above, but that
  // created a real race: a metadata write from the outgoing user can still
  // be in flight when this wipe runs, and if it resolves after the wipe but
  // before the next user reads, that next user would see the previous
  // user's synchronization state. Fixed by scoping the storage key itself
  // by user id instead — every read/write resolves its own owner up front,
  // so no in-flight write can ever land under a different user's key
  // regardless of timing, and nothing here needs to race against it. This
  // also means sync metadata correctly SURVIVES a sign-out/sign-in cycle
  // for the SAME user, which is the intended behavior (acknowledged server
  // versions shouldn't be forgotten just because someone signed out).
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
 *
 * Phase 3A1/3A2/3A3 (sync redesign): 'saved-outfits', 'week-plan', and
 * 'closet-outfit-favourites' are deliberately NOT in this list anymore.
 * This bulk pull-or-push has no CAS/version awareness at all (a bare
 * upsert/overwrite), and all three domains now have their own version-aware
 * reconciliation trigger (lib/saved-outfits-reconciliation.ts's
 * reconcileSavedOutfits, lib/week-plan-reconciliation.ts's reconcileWeekPlan,
 * lib/closet-outfit-favourites-reconciliation.ts's
 * reconcileClosetOutfitFavourites — all fired from
 * contexts/useAuthSideEffects.ts on this exact same HYDRATED/SIGNED_IN
 * checkpoint) — running any of them alongside this bulk strategy would be an
 * uncoordinated dual write. closet-outfit-week-plan below is the one domain
 * this phase deliberately does not migrate, and still relies entirely on
 * this legacy strategy.
 */
export async function syncUserDataOnSignIn(userId: string): Promise<string[]> {
  void logAuthEvent('sync: started', userId);
  return Promise.all([
    syncEntity('closet', CLOSET_KEY, fetchClosetItemsFromSupabase, (items) => upsertManyClosetItemsToSupabase(items, userId), userId),
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
