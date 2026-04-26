import AsyncStorage from '@react-native-async-storage/async-storage';

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

/** Wipes all per-user local data. Call on sign-out so the next user starts clean. */
export async function clearAllLocalUserData(): Promise<void> {
  await Promise.all(
    [CLOSET_KEY, OUTFITS_KEY, WEEK_KEY, SESSION_KEY].map((key) => AsyncStorage.removeItem(key)),
  );
}

/**
 * Called once on SIGNED_IN. Pass the userId from the auth event to avoid
 * a timing race with supabase.auth.getUser().
 *
 * Strategy per entity:
 *   - Cloud has data  → pull to local (cloud wins, covers multi-device sync)
 *   - Cloud is empty  → push local to cloud (one-time migration for existing data)
 */
export async function syncUserDataOnSignIn(userId: string): Promise<void> {
  await Promise.all([
    syncEntity(CLOSET_KEY, fetchClosetItemsFromSupabase, (items) => upsertManyClosetItemsToSupabase(items, userId)),
    syncEntity(OUTFITS_KEY, fetchSavedOutfitsFromSupabase, (items) => upsertManySavedOutfitsToSupabase(items, userId)),
    syncEntity(WEEK_KEY, fetchWeekPlanFromSupabase, (items) => upsertManyWeekPlanItemsToSupabase(items, userId)),
  ]);
}

async function syncEntity<T>(
  storageKey: string,
  fetchFromCloud: () => Promise<T[]>,
  pushToCloud: (items: T[]) => Promise<void>
): Promise<void> {
  try {
    const cloudItems = await fetchFromCloud();

    if (cloudItems.length > 0) {
      await AsyncStorage.setItem(storageKey, JSON.stringify(cloudItems));
    } else {
      const localRaw = await AsyncStorage.getItem(storageKey);
      if (!localRaw) return;
      const localItems = JSON.parse(localRaw) as T[];
      if (Array.isArray(localItems) && localItems.length > 0) {
        await pushToCloud(localItems);
      }
    }
  } catch {
    // Non-fatal: local data remains intact
  }
}
