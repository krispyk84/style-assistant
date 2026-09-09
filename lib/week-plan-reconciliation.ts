import { weekPlanAdapter } from '@/lib/reconciliation-adapters';
import { createSingleFlightRunner, reconcileDomainRecords, type ReconciliationRunSummary } from '@/lib/domain-reconciliation-runner';
import { fetchWeekPlanForReconciliation } from '@/lib/supabase-data';
import { isFutureWeekDay, loadWeekPlan } from '@/lib/week-plan-storage';

// Phase 3A2 (sync redesign) — WEEK-PLAN ONLY. Mirrors
// lib/saved-outfits-reconciliation.ts's role exactly: the one orchestration
// entry point fired both by contexts/useAuthSideEffects.ts's HYDRATED/
// SIGNED_IN lifecycle checkpoint and by week-plan's own best-effort
// post-user-action sync (lib/week-plan-storage.ts's assignOutfitToWeekDay /
// removeWeekPlan). Independent single-flight instance from saved-outfits'
// (createSingleFlightRunner is called fresh here) — a stuck or failing
// week-plan run never blocks or is blocked by a saved-outfits run.
//
// `includeId: isFutureWeekDay` is the one thing week-plan needs that
// saved-outfits doesn't: week-plan is a rolling retention window (today
// through +7 days), and loadWeekPlan already prunes local entries that have
// aged out as pure housekeeping (never a tombstone, never markDeleted). Without
// this filter, a stale row the SERVER or a leftover metadata entry still
// remembers for an aged-out day would look like ordinary internal drift to
// the decision engine (Case M/Case A) and get silently re-downloaded forever
// — the window only ever moves forward, so an excluded id can never become
// relevant again, and reconcileDomainRecords also opportunistically deletes
// any leftover metadata for such ids.
export const reconcileWeekPlan = createSingleFlightRunner((): Promise<ReconciliationRunSummary> =>
  reconcileDomainRecords({
    domain: 'week-plan',
    adapter: weekPlanAdapter,
    idOf: (item) => item.dayKey,
    fetchServerSnapshots: fetchWeekPlanForReconciliation,
    loadLocalRecords: loadWeekPlan,
    includeId: isFutureWeekDay,
  }),
);
