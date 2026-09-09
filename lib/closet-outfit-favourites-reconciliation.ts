import { closetOutfitFavouriteAdapter } from '@/lib/reconciliation-adapters';
import { createSingleFlightRunner, reconcileDomainRecords, type ReconciliationRunSummary } from '@/lib/domain-reconciliation-runner';
import { fetchClosetOutfitFavouritesForReconciliation } from '@/lib/closet-outfit-sync';
import { loadSavedClosetOutfits } from '@/lib/closet-outfit-storage';

// Phase 3A3 (sync redesign) — CLOSET-OUTFIT-FAVOURITES ONLY. Mirrors
// lib/saved-outfits-reconciliation.ts / lib/week-plan-reconciliation.ts's
// role exactly: the one orchestration entry point fired both by
// contexts/useAuthSideEffects.ts's HYDRATED/SIGNED_IN lifecycle checkpoint
// and by favourites' own best-effort post-user-action sync
// (lib/closet-outfit-storage.ts's saveClosetOutfitToFavourites /
// deleteSavedClosetOutfit). Independent single-flight instance — a stuck or
// failing favourites run never blocks or is blocked by saved-outfits' or
// week-plan's.
//
// This is the first domain mediated through our own backend (authenticated
// HTTP -> service -> Prisma) rather than direct Supabase RPCs, but the
// adapter interface is identical, so no changes were needed here or in
// lib/domain-reconciliation-runner.ts itself.
//
// No `includeId` filter: unlike week-plan, favourites have no retention/
// archive window in the current product — every favourite identity remains
// eligible for reconciliation regardless of age (Part 18). Copying week-
// plan's date-expiration filtering here would be solving a problem this
// domain doesn't have.
export const reconcileClosetOutfitFavourites = createSingleFlightRunner((): Promise<ReconciliationRunSummary> =>
  reconcileDomainRecords({
    domain: 'closet-outfit-favourites',
    adapter: closetOutfitFavouriteAdapter,
    idOf: (item) => item.id,
    fetchServerSnapshots: fetchClosetOutfitFavouritesForReconciliation,
    loadLocalRecords: loadSavedClosetOutfits,
  }),
);
