import { savedOutfitAdapter } from '@/lib/reconciliation-adapters';
import { createSingleFlightRunner, reconcileDomainRecords, type ReconciliationRunSummary } from '@/lib/domain-reconciliation-runner';
import { fetchSavedOutfitsForReconciliation } from '@/lib/supabase-data';
import { loadSavedOutfits } from '@/lib/saved-outfits-storage';

// Phase 3A1 (sync redesign) — SAVED-OUTFITS ONLY. This is the one and only
// orchestration entry point that runs the Phase 2B1/2B2 pure engine +
// executor against real saved-outfits state: the SIGNED_IN/HYDRATED
// lifecycle trigger (contexts/useAuthSideEffects.ts) and the best-effort
// post-user-action sync (lib/saved-outfits-storage.ts's saveSavedOutfit /
// deleteSavedOutfit) both call the exact same `reconcileSavedOutfits`
// function below — never a duplicated decision path (Part 9).
//
// Phase 3A2: the batch loop + single-flight coalescing this module used to
// implement inline are now shared with week-plan
// (lib/week-plan-reconciliation.ts) via lib/domain-reconciliation-runner.ts
// — extracted once a second domain needed the identical shape, not built
// speculatively. This file is now just saved-outfits' own small config.

export type { ReconciliationRunSummary as SavedOutfitsReconciliationSummary } from '@/lib/domain-reconciliation-runner';

export const reconcileSavedOutfits = createSingleFlightRunner((): Promise<ReconciliationRunSummary> =>
  reconcileDomainRecords({
    domain: 'saved-outfits',
    adapter: savedOutfitAdapter,
    idOf: (outfit) => outfit.id,
    fetchServerSnapshots: fetchSavedOutfitsForReconciliation,
    loadLocalRecords: loadSavedOutfits,
  }),
);
