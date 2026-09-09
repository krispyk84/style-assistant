import { closetOutfitWeekPlanAdapter } from '@/lib/reconciliation-adapters';
import { createSingleFlightRunner, reconcileDomainRecords, type ReconciliationRunSummary } from '@/lib/domain-reconciliation-runner';
import { fetchClosetOutfitWeekPlanForReconciliation } from '@/lib/closet-outfit-sync';
import { isFutureWeekDay, loadClosetWeekPlan } from '@/lib/closet-outfit-storage';

// Phase 3A4 (sync redesign) — CLOSET-OUTFIT-WEEK-PLAN ONLY, the fourth and
// final domain. Mirrors lib/week-plan-reconciliation.ts's role exactly
// (same slot/keyed shape, same retention-window concern), but backend-
// mediated like lib/closet-outfit-favourites-reconciliation.ts rather than
// direct Supabase. Fired both by contexts/useAuthSideEffects.ts's HYDRATED/
// SIGNED_IN lifecycle checkpoint and by this domain's own best-effort
// post-user-action sync (lib/closet-outfit-storage.ts's
// assignClosetOutfitToWeekDay / removeClosetWeekPlanDay). Independent
// single-flight instance — a stuck or failing run here never blocks or is
// blocked by any of the other three domains'.
//
// `includeId: isFutureWeekDay` closes the exact same day-rollover
// resurrection hazard Phase 3A2 §O.2 found and fixed for ordinary
// week-plan: loadClosetWeekPlan already prunes locally-expired days as pure
// housekeeping (never a tombstone, never markDeleted), so without this
// filter a stale row the server or a leftover metadata entry still
// remembers for an expired day would look like ordinary internal drift
// (Case M/Case A) and get silently re-downloaded forever. reconcileDomainRecords
// also opportunistically removes any leftover metadata for an excluded id
// regardless of its dirty state — audited explicitly for this phase (see
// docs/sync-phase2a-reconciliation-spec.md's Phase 3A4 section): once a day
// has rolled out of the display window, the app will never show or act on
// it again on THIS device, so any unsynced intent for it has no further
// product value to preserve, and no other device's reconciliation is
// affected (each device's window is its own local clock's view).
export const reconcileClosetOutfitWeekPlan = createSingleFlightRunner((): Promise<ReconciliationRunSummary> =>
  reconcileDomainRecords({
    domain: 'closet-outfit-week-plan',
    adapter: closetOutfitWeekPlanAdapter,
    idOf: (item) => item.dayKey,
    fetchServerSnapshots: fetchClosetOutfitWeekPlanForReconciliation,
    loadLocalRecords: loadClosetWeekPlan,
    includeId: isFutureWeekDay,
  }),
);
