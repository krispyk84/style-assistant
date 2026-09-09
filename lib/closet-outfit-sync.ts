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
  const response = await createApiClient().request('/closet-outfit-sync/favourites', { method: 'POST', body: favourite });
  if (!response.success) throw new Error(response.error?.message ?? 'Failed to upsert closet outfit favourite.');
}

export async function upsertManyClosetOutfitFavouritesToBackend(favourites: SavedClosetOutfit[]): Promise<void> {
  await Promise.all(favourites.map((favourite) => upsertClosetOutfitFavouriteToBackend(favourite)));
}

export async function deleteClosetOutfitFavouriteFromBackend(id: string): Promise<void> {
  const response = await createApiClient().request(`/closet-outfit-sync/favourites/${id}`, { method: 'DELETE' });
  if (!response.success) throw new Error(response.error?.message ?? 'Failed to delete closet outfit favourite.');
}

export async function fetchClosetOutfitWeekPlanFromBackend(): Promise<ClosetWeekPlanItem[]> {
  const response = await createApiClient().request<{ items: ClosetWeekPlanItem[] }>('/closet-outfit-sync/week-plan');
  if (!response.success || !response.data) return [];
  return response.data.items;
}

export async function upsertClosetOutfitWeekPlanItemToBackend(item: ClosetWeekPlanItem): Promise<void> {
  const response = await createApiClient().request('/closet-outfit-sync/week-plan', { method: 'POST', body: item });
  if (!response.success) throw new Error(response.error?.message ?? 'Failed to upsert closet outfit week-plan item.');
}

export async function upsertManyClosetOutfitWeekPlanItemsToBackend(items: ClosetWeekPlanItem[]): Promise<void> {
  await Promise.all(items.map((item) => upsertClosetOutfitWeekPlanItemToBackend(item)));
}

export async function deleteClosetOutfitWeekPlanItemFromBackend(dayKey: string): Promise<void> {
  const response = await createApiClient().request(`/closet-outfit-sync/week-plan/${dayKey}`, { method: 'DELETE' });
  if (!response.success) throw new Error(response.error?.message ?? 'Failed to delete closet outfit week-plan item.');
}

// ── Phase 1A /version-aware endpoint wrappers (Phase 2B2 reconciliation
// execution) ─────────────────────────────────────────────────────────────
// Thin, purely mechanical wrappers around the version-aware routes added
// in Phase 1A (backend/src/modules/closet-outfit-sync/closet-outfit-sync.routes.ts)
// — map to {status, item} response bodies into the small structural result
// shape lib/reconciliation-executor.ts's DomainAdapter expects. No current
// caller. The underlying CAS logic (atomic Prisma updateMany) was already
// tested in Phase 1A's own repository/service test suites; these wrappers
// are unit-tested against response fixtures matching that shape, not
// re-verified against a live database here.

type ClosetOutfitMutationStatus = 'created' | 'create_conflict' | 'applied' | 'conflict' | 'not_found';

export type ClosetOutfitFavouriteMutationResult = {
  status: ClosetOutfitMutationStatus;
  version: number | null;
  deletedAt: string | null;
  content: SavedClosetOutfit | null;
};

type FavouriteItemBody = { id: string; formality: string; outfit: unknown; savedAt: string; syncVersion: number; deletedAt: string | null };

function normalizeFavouriteMutationBody(body: { status: ClosetOutfitMutationStatus; item: FavouriteItemBody | null } | null | undefined): ClosetOutfitFavouriteMutationResult {
  const status = body?.status ?? 'not_found';
  const item = body?.item;
  if (!item) return { status, version: null, deletedAt: null, content: null };
  return {
    status,
    version: item.syncVersion,
    deletedAt: item.deletedAt,
    content: { id: item.id, formality: item.formality as SavedClosetOutfit['formality'], outfit: item.outfit as SavedClosetOutfit['outfit'], savedAt: item.savedAt },
  };
}

export async function createClosetOutfitFavouriteViaRpc(favourite: SavedClosetOutfit): Promise<ClosetOutfitFavouriteMutationResult> {
  const response = await createApiClient().request<{ status: ClosetOutfitMutationStatus; item: FavouriteItemBody | null }>(
    '/closet-outfit-sync/favourites/version-aware',
    { method: 'POST', body: favourite },
  );
  if (!response.success) throw new Error(response.error?.message ?? 'Failed to create closet outfit favourite (version-aware).');
  return normalizeFavouriteMutationBody(response.data);
}

export async function updateClosetOutfitFavouriteViaRpc(favourite: SavedClosetOutfit, baseVersion: number): Promise<ClosetOutfitFavouriteMutationResult> {
  const response = await createApiClient().request<{ status: ClosetOutfitMutationStatus; item: FavouriteItemBody | null }>(
    `/closet-outfit-sync/favourites/${favourite.id}/version-aware`,
    { method: 'PATCH', body: { baseVersion, formality: favourite.formality, outfit: favourite.outfit, savedAt: favourite.savedAt } },
  );
  if (!response.success) throw new Error(response.error?.message ?? 'Failed to update closet outfit favourite (version-aware).');
  return normalizeFavouriteMutationBody(response.data);
}

export async function deleteClosetOutfitFavouriteViaRpc(id: string, baseVersion: number): Promise<ClosetOutfitFavouriteMutationResult> {
  const response = await createApiClient().request<{ status: ClosetOutfitMutationStatus; item: FavouriteItemBody | null }>(
    `/closet-outfit-sync/favourites/${id}/version-aware?baseVersion=${baseVersion}`,
    { method: 'DELETE' },
  );
  if (!response.success) throw new Error(response.error?.message ?? 'Failed to delete closet outfit favourite (version-aware).');
  return normalizeFavouriteMutationBody(response.data);
}

// Phase 3A3 (sync redesign) — reconciliation-only server read: includes
// tombstoned rows and syncVersion/deletedAt (backend/.../closet-outfit-sync
// .service.ts's getFavouritesForReconciliation, already built in Phase 2B1,
// had no frontend caller until now). Never use for an ordinary UI list —
// fetchClosetOutfitFavouritesFromBackend above already filters deletedAt for
// that. Matches lib/supabase-data.ts's SavedOutfitServerSnapshot /
// WeekPlanItemServerSnapshot shape exactly, which is what
// lib/domain-reconciliation-runner.ts's DomainSnapshot<TContent> expects.
export type ClosetOutfitFavouriteServerSnapshot = SavedClosetOutfit & { syncVersion: number; deletedAt: string | null };

export async function fetchClosetOutfitFavouritesForReconciliation(): Promise<ClosetOutfitFavouriteServerSnapshot[]> {
  const response = await createApiClient().request<{ items: ClosetOutfitFavouriteServerSnapshot[] }>('/closet-outfit-sync/favourites/for-reconciliation');
  if (!response.success || !response.data) return [];
  return response.data.items;
}

export type ClosetOutfitWeekPlanItemMutationResult = {
  status: ClosetOutfitMutationStatus;
  version: number | null;
  deletedAt: string | null;
  content: ClosetWeekPlanItem | null;
};

type WeekPlanItemBody = { dayKey: string; dayLabel: string; formality: string; outfit: unknown; assignedAt: string; syncVersion: number; deletedAt: string | null };

function normalizeWeekPlanItemMutationBody(body: { status: ClosetOutfitMutationStatus; item: WeekPlanItemBody | null } | null | undefined): ClosetOutfitWeekPlanItemMutationResult {
  const status = body?.status ?? 'not_found';
  const item = body?.item;
  if (!item) return { status, version: null, deletedAt: null, content: null };
  return {
    status,
    version: item.syncVersion,
    deletedAt: item.deletedAt,
    content: { dayKey: item.dayKey, dayLabel: item.dayLabel, formality: item.formality as ClosetWeekPlanItem['formality'], outfit: item.outfit as ClosetWeekPlanItem['outfit'], assignedAt: item.assignedAt },
  };
}

export async function createClosetOutfitWeekPlanItemViaRpc(item: ClosetWeekPlanItem): Promise<ClosetOutfitWeekPlanItemMutationResult> {
  const response = await createApiClient().request<{ status: ClosetOutfitMutationStatus; item: WeekPlanItemBody | null }>(
    '/closet-outfit-sync/week-plan/version-aware',
    { method: 'POST', body: item },
  );
  if (!response.success) throw new Error(response.error?.message ?? 'Failed to create closet outfit week-plan item (version-aware).');
  return normalizeWeekPlanItemMutationBody(response.data);
}

export async function updateClosetOutfitWeekPlanItemViaRpc(item: ClosetWeekPlanItem, baseVersion: number): Promise<ClosetOutfitWeekPlanItemMutationResult> {
  const response = await createApiClient().request<{ status: ClosetOutfitMutationStatus; item: WeekPlanItemBody | null }>(
    `/closet-outfit-sync/week-plan/${item.dayKey}/version-aware`,
    { method: 'PATCH', body: { baseVersion, dayLabel: item.dayLabel, formality: item.formality, outfit: item.outfit, assignedAt: item.assignedAt } },
  );
  if (!response.success) throw new Error(response.error?.message ?? 'Failed to update closet outfit week-plan item (version-aware).');
  return normalizeWeekPlanItemMutationBody(response.data);
}

export async function deleteClosetOutfitWeekPlanItemViaRpc(dayKey: string, baseVersion: number): Promise<ClosetOutfitWeekPlanItemMutationResult> {
  const response = await createApiClient().request<{ status: ClosetOutfitMutationStatus; item: WeekPlanItemBody | null }>(
    `/closet-outfit-sync/week-plan/${dayKey}/version-aware?baseVersion=${baseVersion}`,
    { method: 'DELETE' },
  );
  if (!response.success) throw new Error(response.error?.message ?? 'Failed to delete closet outfit week-plan item (version-aware).');
  return normalizeWeekPlanItemMutationBody(response.data);
}

// Phase 3A4 (sync redesign) — reconciliation-only server read: includes
// tombstoned rows and syncVersion/deletedAt (backend/.../closet-outfit-sync
// .service.ts's getWeekPlanForReconciliation, already built in Phase 2B1,
// had no frontend caller until now). Never use for an ordinary UI list —
// fetchClosetOutfitWeekPlanFromBackend above already filters deletedAt for
// that. Matches lib/domain-reconciliation-runner.ts's DomainSnapshot<TContent>
// shape exactly (ClosetWeekPlanItem & {syncVersion, deletedAt}).
export type ClosetOutfitWeekPlanItemServerSnapshot = ClosetWeekPlanItem & { syncVersion: number; deletedAt: string | null };

export async function fetchClosetOutfitWeekPlanForReconciliation(): Promise<ClosetOutfitWeekPlanItemServerSnapshot[]> {
  const response = await createApiClient().request<{ items: ClosetOutfitWeekPlanItemServerSnapshot[] }>('/closet-outfit-sync/week-plan/for-reconciliation');
  if (!response.success || !response.data) return [];
  return response.data.items;
}
