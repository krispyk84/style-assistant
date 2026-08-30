import { createApiClient } from '@/lib/api/api-client';
import type { SavedClosetOutfit, ClosetWeekPlanItem } from '@/lib/closet-outfit-storage';

// Cloud backup for "Create Outfits From My Closet" favourites + week plan —
// this data previously lived ONLY in on-device AsyncStorage with no server
// copy at all, so clearing local storage (e.g. the sign-out cleanup sweep)
// permanently destroyed it. Mirrors lib/supabase-data.ts's fetch/upsert
// pattern for the other locally-cached domains, but goes through our own
// backend (closet-outfit-sync module) rather than a direct Supabase table,
// since this data has no existing direct-Supabase table to attach to.

export async function fetchClosetOutfitFavouritesFromBackend(): Promise<SavedClosetOutfit[]> {
  const response = await createApiClient().request<{ items: SavedClosetOutfit[] }>('/closet-outfit-sync/favourites');
  if (!response.success || !response.data) return [];
  return response.data.items;
}

export async function upsertClosetOutfitFavouriteToBackend(favourite: SavedClosetOutfit): Promise<void> {
  await createApiClient().request('/closet-outfit-sync/favourites', { method: 'POST', body: favourite });
}

export async function upsertManyClosetOutfitFavouritesToBackend(favourites: SavedClosetOutfit[]): Promise<void> {
  await Promise.all(favourites.map((favourite) => upsertClosetOutfitFavouriteToBackend(favourite)));
}

export async function deleteClosetOutfitFavouriteFromBackend(id: string): Promise<void> {
  await createApiClient().request(`/closet-outfit-sync/favourites/${id}`, { method: 'DELETE' });
}

export async function fetchClosetOutfitWeekPlanFromBackend(): Promise<ClosetWeekPlanItem[]> {
  const response = await createApiClient().request<{ items: ClosetWeekPlanItem[] }>('/closet-outfit-sync/week-plan');
  if (!response.success || !response.data) return [];
  return response.data.items;
}

export async function upsertClosetOutfitWeekPlanItemToBackend(item: ClosetWeekPlanItem): Promise<void> {
  await createApiClient().request('/closet-outfit-sync/week-plan', { method: 'POST', body: item });
}

export async function upsertManyClosetOutfitWeekPlanItemsToBackend(items: ClosetWeekPlanItem[]): Promise<void> {
  await Promise.all(items.map((item) => upsertClosetOutfitWeekPlanItemToBackend(item)));
}

export async function deleteClosetOutfitWeekPlanItemFromBackend(dayKey: string): Promise<void> {
  await createApiClient().request(`/closet-outfit-sync/week-plan/${dayKey}`, { method: 'DELETE' });
}
