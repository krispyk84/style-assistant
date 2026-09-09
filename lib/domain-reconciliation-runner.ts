import { recordError } from '@/lib/crashlytics';
import { logAuthEvent } from '@/lib/auth-event-log';
import type { DomainAdapter, ExecutionOutcome } from '@/lib/reconciliation-executor';
import { executeReconciliation } from '@/lib/reconciliation-executor';
import type { ReconciliationInput, ServerState } from '@/lib/reconciliation-decision-engine';
import { getDomainMetadata, removeMetadata, type SyncDomain } from '@/lib/sync-metadata-storage';
import { getCurrentUserId } from '@/lib/supabase-data';

// Phase 3A2 (sync redesign) — extracted from lib/saved-outfits-reconciliation.ts
// (Phase 3A1) once a second domain (week-plan) needed the exact same
// per-record decide→execute batch, redecide-required convergence, and
// single-flight/coalescing shape. This is deliberately NOT a generic
// synchronization framework: no registration, no protocol negotiation, no
// domain discovery — just the two genuinely domain-agnostic pieces (the
// batch loop, and the single-flight wrapper), each domain still owns its
// own small reconciliation module that supplies the domain-specific reads
// and passes them in as plain config.

export type ReconciliationRunSummary = {
  considered: number;
  success: number;
  noOp: number;
  dirtyRemaining: number;
  conflicts: number;
  deferred: number;
  operationalFailures: number;
  /**
   * Phase 3B compatibility-era anomaly counters — never overlap with the
   * outcome counters above (a drift/lineage-reset record is ALSO counted as
   * success/no_op/conflict there; these are additional classification, not
   * a separate bucket). A legacy write can change content without
   * incrementing sync_version (§B.1's audit), so a nonzero
   * sameVersionDrift rate is a direct signal of how much active legacy-
   * client mutation is still happening in the wild — see
   * docs/sync-phase2a-reconciliation-spec.md's Phase 3B section for the
   * full rollout-telemetry design this feeds.
   */
  sameVersionDrift: number;
  versionLineageReset: number;
  skippedReason?: string;
};

function emptySummary(skippedReason?: string): ReconciliationRunSummary {
  return { considered: 0, success: 0, noOp: 0, dirtyRemaining: 0, conflicts: 0, deferred: 0, operationalFailures: 0, sameVersionDrift: 0, versionLineageReset: 0, skippedReason };
}

function reasonOf(outcome: ExecutionOutcome | { kind: 'not_converged' }): string | null {
  if (outcome.kind === 'conflict') return outcome.detail.reason;
  if (outcome.kind === 'success' || outcome.kind === 'no_op' || outcome.kind === 'deferred') return outcome.reason;
  return null;
}

/** The shape every domain's reconciliation-only server read must return: the
 * domain's own content type plus the two sync columns every Phase 1A table
 * carries. Matches supabase-data.ts's SavedOutfitServerSnapshot /
 * WeekPlanItemServerSnapshot exactly — this type just names that shape once. */
export type DomainSnapshot<TContent> = TContent & { syncVersion: number; deletedAt: string | null };

function toServerState<TContent>(snapshot: DomainSnapshot<TContent> | undefined): ServerState {
  if (!snapshot) return { kind: 'absent' };
  return snapshot.deletedAt !== null
    ? { kind: 'tombstone', version: snapshot.syncVersion }
    : { kind: 'active', version: snapshot.syncVersion };
}

function toServerContent<TContent>(snapshot: DomainSnapshot<TContent> | undefined): TContent | null {
  if (!snapshot) return null;
  const { syncVersion: _syncVersion, deletedAt: _deletedAt, ...content } = snapshot;
  void _syncVersion;
  void _deletedAt;
  return content as unknown as TContent;
}

export type DomainReconciliationConfig<TContent> = {
  domain: SyncDomain;
  adapter: DomainAdapter<TContent>;
  idOf: (content: TContent) => string;
  fetchServerSnapshots: () => Promise<DomainSnapshot<TContent>[]>;
  loadLocalRecords: () => Promise<TContent[]>;
  /**
   * Optional identity filter. An id this predicate rejects is skipped
   * entirely — never decided, never counted as considered, never mutated —
   * and if it still has a leftover metadata entry, that entry is removed
   * (opportunistic cleanup; it can never become relevant again). Used by
   * week-plan to keep its rolling retention window from resurrecting an
   * expired day via Case M/Case A drift-repair (Phase 3A2 §14) — saved-
   * outfits has no equivalent concept and omits this.
   */
  includeId?: (id: string) => boolean;
};

// A create/update/delete RPC's own 'conflict'/'create_conflict'/'not_found'
// response can prove the engine's initial decision is already stale (§18's
// executor never substitutes a fresher version to force a mutation through,
// but IS allowed to re-derive a decision from genuinely fresher facts). One
// bounded retry using exactly the fresher server state the RPC itself
// returned — never a brand-new network read, and never more than once, so
// a persistently-colliding id reports as not-converged rather than looping.
async function reconcileOneRecord<TContent>(
  domain: SyncDomain,
  adapter: DomainAdapter<TContent>,
  id: string,
  initialInput: ReconciliationInput,
  localContent: TContent | null,
  initialServerContent: TContent | null,
): Promise<ExecutionOutcome | { kind: 'not_converged' }> {
  let input = initialInput;
  let serverContent = initialServerContent;

  for (let attempt = 0; attempt < 2; attempt++) {
    const outcome = await executeReconciliation<TContent>({ domain, id, input, localContent, serverContent, adapter });
    if (outcome.kind !== 'redecide_required') return outcome;
    input = { ...input, server: outcome.server };
    serverContent = (outcome.content as TContent | null) ?? null;
  }
  return { kind: 'not_converged' };
}

export async function reconcileDomainRecords<TContent>(config: DomainReconciliationConfig<TContent>): Promise<ReconciliationRunSummary> {
  const { domain, adapter, idOf, fetchServerSnapshots, loadLocalRecords, includeId } = config;

  const userId = await getCurrentUserId();
  if (!userId) {
    return emptySummary('no-authenticated-user');
  }

  void logAuthEvent(`${domain}-reconcile: started`, userId);

  const [serverSnapshots, localRecords, metadataMap] = await Promise.all([
    fetchServerSnapshots(),
    loadLocalRecords(),
    getDomainMetadata(domain),
  ]);

  const serverById = new Map(serverSnapshots.map((snapshot) => [idOf(snapshot), snapshot]));
  const localById = new Map(localRecords.map((record) => [idOf(record), record]));
  const allIds = new Set<string>([...serverById.keys(), ...localById.keys(), ...Object.keys(metadataMap)]);

  const ids = includeId ? [...allIds].filter(includeId) : [...allIds];

  if (includeId) {
    const excludedIds = [...allIds].filter((id) => !includeId(id));
    for (const id of excludedIds) {
      if (metadataMap[id]) {
        try {
          await removeMetadata(domain, id);
        } catch (error) {
          recordError(error, `${domain}_reconcile_stale_metadata_cleanup`);
        }
      }
    }
  }

  const summary = emptySummary();
  summary.considered = ids.length;

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
      outcome = await reconcileOneRecord(domain, adapter, id, input, localContent, serverContent);
    } catch (error) {
      summary.operationalFailures += 1;
      if (wasDirty) summary.dirtyRemaining += 1;
      recordError(error, `${domain}_reconcile_record`);
      continue;
    }

    const reason = reasonOf(outcome);
    if (reason === 'B-same-version-content-drift-adopt' || reason === 'D-same-version-already-matches-adopt') {
      summary.sameVersionDrift += 1;
    }
    if (reason?.startsWith('V-')) {
      summary.versionLineageReset += 1;
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
        recordError(outcome.error, `${domain}_reconcile_operational_failure`);
        break;
      case 'inconsistent_state':
        summary.operationalFailures += 1;
        if (wasDirty) summary.dirtyRemaining += 1;
        recordError(new Error(outcome.detail), `${domain}_reconcile_inconsistent_state`);
        break;
      case 'not_converged':
      case 'redecide_required': {
        // 'redecide_required' should never actually surface here —
        // reconcileOneRecord's bounded retry loop always either returns
        // early or falls through to 'not_converged' first. Handled
        // defensively rather than assumed unreachable.
        summary.operationalFailures += 1;
        if (wasDirty) summary.dirtyRemaining += 1;
        recordError(new Error(`${domain} reconciliation did not converge for id ${id} after one redecide retry`), `${domain}_reconcile_not_converged`);
        break;
      }
      default: {
        const exhaustive: never = outcome;
        void exhaustive;
      }
    }
  }

  void logAuthEvent(
    `${domain}-reconcile: completed considered=${summary.considered} success=${summary.success} noOp=${summary.noOp} dirtyRemaining=${summary.dirtyRemaining} conflicts=${summary.conflicts} deferred=${summary.deferred} operationalFailures=${summary.operationalFailures} sameVersionDrift=${summary.sameVersionDrift} versionLineageReset=${summary.versionLineageReset}`,
    userId,
  );

  return summary;
}

// Single-flight with exactly-one-coalesced-follow-up: a caller that arrives
// while a run is already in flight cannot assume that run's already-taken
// snapshot includes a local write this caller just made (the snapshot may
// have been read before that write happened). Rather than joining the stale
// in-flight run, such a caller is handed a promise for the NEXT run —
// guaranteed to start only after the current one settles, so its own fresh
// snapshot read is guaranteed to observe every write that happened-before
// this call. Multiple callers arriving during the same active run all share
// that one queued follow-up rather than each queuing their own. Each call to
// createSingleFlightRunner owns its own independent activeRun/queuedRun
// state — two domains never share or block on each other's runs.
export function createSingleFlightRunner<T>(run: () => Promise<T>): () => Promise<T> {
  let activeRun: Promise<T> | null = null;
  let queuedRun: Promise<T> | null = null;

  function trigger(): Promise<T> {
    if (!activeRun) {
      activeRun = run().finally(() => {
        activeRun = null;
      });
      return activeRun;
    }
    if (!queuedRun) {
      const runningRun = activeRun;
      queuedRun = runningRun.catch(() => undefined).then(() => {
        queuedRun = null;
        return trigger();
      });
    }
    return queuedRun;
  }

  return trigger;
}
