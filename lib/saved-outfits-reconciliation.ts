import { recordError } from '@/lib/crashlytics';
import { logAuthEvent } from '@/lib/auth-event-log';
import type { ExecutionOutcome } from '@/lib/reconciliation-executor';
import { executeReconciliation } from '@/lib/reconciliation-executor';
import { savedOutfitAdapter } from '@/lib/reconciliation-adapters';
import type { ReconciliationInput, ServerState } from '@/lib/reconciliation-decision-engine';
import { getDomainMetadata } from '@/lib/sync-metadata-storage';
import { fetchSavedOutfitsForReconciliation, getCurrentUserId, type SavedOutfitServerSnapshot } from '@/lib/supabase-data';
import { loadSavedOutfits } from '@/lib/saved-outfits-storage';
import type { SavedOutfit } from '@/types/style';

// Phase 3A1 (sync redesign) — SAVED-OUTFITS ONLY. This is the one and only
// orchestration entry point that runs the Phase 2B1/2B2 pure engine +
// executor against real saved-outfits state: the SIGNED_IN/HYDRATED
// lifecycle trigger (contexts/useAuthSideEffects.ts) and the best-effort
// post-user-action sync (lib/saved-outfits-storage.ts's saveSavedOutfit /
// deleteSavedOutfit) both call the exact same `reconcileSavedOutfits`
// function below — never a duplicated decision path (Part 9). The other
// three sync-project domains (week-plan, closet-outfit-favourites,
// closet-outfit-week-plan) have no equivalent module yet and remain on
// their pre-Phase-3 legacy behavior entirely (Part 17).

export type SavedOutfitsReconciliationSummary = {
  considered: number;
  success: number;
  noOp: number;
  dirtyRemaining: number;
  conflicts: number;
  deferred: number;
  operationalFailures: number;
  skippedReason?: string;
};

function emptySummary(skippedReason?: string): SavedOutfitsReconciliationSummary {
  return { considered: 0, success: 0, noOp: 0, dirtyRemaining: 0, conflicts: 0, deferred: 0, operationalFailures: 0, skippedReason };
}

function toServerState(snapshot: SavedOutfitServerSnapshot | undefined): ServerState {
  if (!snapshot) return { kind: 'absent' };
  return snapshot.deletedAt !== null
    ? { kind: 'tombstone', version: snapshot.syncVersion }
    : { kind: 'active', version: snapshot.syncVersion };
}

function toServerContent(snapshot: SavedOutfitServerSnapshot | undefined): SavedOutfit | null {
  if (!snapshot) return null;
  return {
    id: snapshot.id,
    requestId: snapshot.requestId,
    savedAt: snapshot.savedAt,
    input: snapshot.input,
    recommendation: snapshot.recommendation,
  };
}

// A create/update/delete RPC's own 'conflict'/'create_conflict'/'not_found'
// response can prove the engine's initial decision is already stale (§18's
// executor never substitutes a fresher version to force a mutation through,
// but IS allowed to re-derive a decision from genuinely fresher facts). One
// bounded retry using exactly the fresher server state the RPC itself
// returned — never a brand-new network read, and never more than once, so
// a persistently-colliding id reports as not-converged rather than looping.
async function reconcileOneRecord(
  id: string,
  initialInput: ReconciliationInput,
  localContent: SavedOutfit | null,
  initialServerContent: SavedOutfit | null,
): Promise<ExecutionOutcome | { kind: 'not_converged' }> {
  let input = initialInput;
  let serverContent = initialServerContent;

  for (let attempt = 0; attempt < 2; attempt++) {
    const outcome = await executeReconciliation<SavedOutfit>({
      domain: 'saved-outfits',
      id,
      input,
      localContent,
      serverContent,
      adapter: savedOutfitAdapter,
    });
    if (outcome.kind !== 'redecide_required') return outcome;
    input = { ...input, server: outcome.server };
    serverContent = (outcome.content as SavedOutfit | null) ?? null;
  }
  return { kind: 'not_converged' };
}

async function performReconciliationRun(): Promise<SavedOutfitsReconciliationSummary> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return emptySummary('no-authenticated-user');
  }

  void logAuthEvent('saved-outfits-reconcile: started', userId);

  const [serverRecords, localRecords, metadataMap] = await Promise.all([
    fetchSavedOutfitsForReconciliation(),
    loadSavedOutfits(),
    getDomainMetadata('saved-outfits'),
  ]);

  const serverById = new Map(serverRecords.map((record) => [record.id, record]));
  const localById = new Map(localRecords.map((record) => [record.id, record]));
  const ids = new Set<string>([...serverById.keys(), ...localById.keys(), ...Object.keys(metadataMap)]);

  const summary = emptySummary();
  summary.considered = ids.size;

  for (const id of ids) {
    const metadata = metadataMap[id] ?? null;
    const wasDirty = metadata?.isDirty ?? false;
    const localPresent = localById.has(id);
    const localContent = localById.get(id) ?? null;
    const serverSnapshot = serverById.get(id);
    const input: ReconciliationInput = { localPresent, metadata, server: toServerState(serverSnapshot) };
    const serverContent = toServerContent(serverSnapshot);

    let outcome: ExecutionOutcome | { kind: 'not_converged' };
    try {
      outcome = await reconcileOneRecord(id, input, localContent, serverContent);
    } catch (error) {
      summary.operationalFailures += 1;
      if (wasDirty) summary.dirtyRemaining += 1;
      recordError(error, 'saved_outfits_reconcile_record');
      continue;
    }

    switch (outcome.kind) {
      case 'success':
        summary.success += 1;
        break;
      case 'no_op':
        summary.noOp += 1;
        break;
      case 'conflict':
        summary.conflicts += 1;
        if (wasDirty) summary.dirtyRemaining += 1;
        break;
      case 'deferred':
        summary.deferred += 1;
        if (wasDirty) summary.dirtyRemaining += 1;
        break;
      case 'operational_failure':
        summary.operationalFailures += 1;
        if (wasDirty) summary.dirtyRemaining += 1;
        recordError(outcome.error, 'saved_outfits_reconcile_operational_failure');
        break;
      case 'inconsistent_state':
        summary.operationalFailures += 1;
        if (wasDirty) summary.dirtyRemaining += 1;
        recordError(new Error(outcome.detail), 'saved_outfits_reconcile_inconsistent_state');
        break;
      case 'not_converged':
      case 'redecide_required': {
        // 'redecide_required' should never actually surface here —
        // reconcileOneRecord's bounded retry loop always either returns
        // early or falls through to 'not_converged' first. Handled
        // defensively (never silently dropped) rather than assumed
        // unreachable, in case that loop's bound ever changes.
        summary.operationalFailures += 1;
        if (wasDirty) summary.dirtyRemaining += 1;
        recordError(new Error(`saved-outfits reconciliation did not converge for id ${id} after one redecide retry`), 'saved_outfits_reconcile_not_converged');
        break;
      }
      default: {
        const exhaustive: never = outcome;
        void exhaustive;
      }
    }
  }

  void logAuthEvent(
    `saved-outfits-reconcile: completed considered=${summary.considered} success=${summary.success} noOp=${summary.noOp} dirtyRemaining=${summary.dirtyRemaining} conflicts=${summary.conflicts} deferred=${summary.deferred} operationalFailures=${summary.operationalFailures}`,
    userId,
  );

  return summary;
}

// Single-flight with exactly-one-coalesced-follow-up (Parts 9/14): a caller
// that arrives while a run is already in flight cannot assume that run's
// already-taken snapshot includes a local write this caller just made (the
// snapshot may have been read before that write happened). Rather than
// joining the stale in-flight run, such a caller is handed a promise for
// the NEXT run — guaranteed to start only after the current one settles, so
// its own fresh snapshot read is guaranteed to observe every write that
// happened-before this call. Multiple callers arriving during the same
// active run all share that one queued follow-up rather than each queuing
// their own (no duplicate runs, no missed writes).
let activeRun: Promise<SavedOutfitsReconciliationSummary> | null = null;
let queuedRun: Promise<SavedOutfitsReconciliationSummary> | null = null;

export function reconcileSavedOutfits(): Promise<SavedOutfitsReconciliationSummary> {
  if (!activeRun) {
    activeRun = performReconciliationRun().finally(() => {
      activeRun = null;
    });
    return activeRun;
  }
  if (!queuedRun) {
    const runningRun = activeRun;
    queuedRun = runningRun.catch(() => undefined).then(() => {
      queuedRun = null;
      return reconcileSavedOutfits();
    });
  }
  return queuedRun;
}
