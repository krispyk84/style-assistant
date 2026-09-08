import {
  decideReconciliation,
  type ReconciliationAction,
  type ReconciliationInput,
} from '@/lib/reconciliation-decision-engine';
import { applyMetadataPatch, removeMetadata, type SyncDomain } from '@/lib/sync-metadata-storage';

// Phase 2B2 (sync redesign): the reconciliation EXECUTION layer. Carries out
// exactly one already-decided action against real local storage and the
// Phase 1A CAS primitives. This module is deliberately NOT wired into any
// production flow — see docs/sync-phase2a-reconciliation-spec.md's Phase 3
// cutover section for why, and this session's Phase 2B2 report for the
// dual-write hazard that makes wiring it in unsafe today.
//
// Architecture (never violated):
//   facts -> decideReconciliation (pure) -> ReconciliationResult -> executor -> side effects
// The executor NEVER re-derives policy. It does not expose a way to run an
// action without going through decideReconciliation first (§18): callers
// supply raw facts (ReconciliationInput) plus content, and
// executeReconciliation calls the pure engine itself — there is no
// executeAction(action, baseVersion) entry point a caller could use to
// smuggle an arbitrary baseVersion past the decision the facts actually
// produced. baseVersion, wherever used, is always read directly off the
// SAME `input.metadata.lastSeenVersion` that was fed to the engine.

/**
 * The authoritative response shape every domain adapter's create/update/
 * delete calls must normalize to — mirrors Phase 1A's actual RPC contract
 * (every branch except 'not_found' returns the current authoritative row).
 */
export type RpcMutationResult<TContent> = {
  status: 'created' | 'create_conflict' | 'applied' | 'conflict' | 'not_found';
  version: number | null;
  deletedAt: string | null;
  content: TContent | null;
};

/**
 * The minimum per-domain surface the executor needs. Deliberately NOT a
 * repository/factory/DI framework — a plain object of async functions,
 * tailored to what execute() actually calls. `compareContent` is the
 * canonical semantic-equality check (§15) — never raw JSON.stringify
 * unless a domain's audit specifically proves that's safe (see each
 * concrete adapter's own comment for its domain's actual rule).
 */
export type DomainAdapter<TContent> = {
  writeLocal(id: string, content: TContent): Promise<void>;
  removeLocal(id: string): Promise<void>;
  createServer(id: string, content: TContent): Promise<RpcMutationResult<TContent>>;
  updateServer(id: string, baseVersion: number, content: TContent): Promise<RpcMutationResult<TContent>>;
  deleteServer(id: string, baseVersion: number): Promise<RpcMutationResult<TContent>>;
  compareContent(a: TContent, b: TContent): boolean;
};

export type ConflictDetail = {
  domain: SyncDomain;
  id: string;
  action: ReconciliationAction;
  reason: string;
  acknowledgedBaseVersion: number | null;
  currentServerVersion: number | null;
  currentServerDeleted: boolean;
};

export type ExecutionOutcome =
  | { kind: 'success'; action: ReconciliationAction; reason: string }
  | { kind: 'no_op'; reason: string }
  | { kind: 'deferred'; reason: string }
  | { kind: 'redecide_required'; reason: string; server: ReconciliationInput['server']; content: unknown }
  | { kind: 'conflict'; detail: ConflictDetail }
  | { kind: 'operational_failure'; action: ReconciliationAction; error: unknown }
  | { kind: 'inconsistent_state'; detail: string };

export type ExecutionRequest<TContent> = {
  domain: SyncDomain;
  id: string;
  /** The exact facts to decide from. baseVersion for any mutation is ALWAYS input.metadata?.lastSeenVersion — never supplied separately. */
  input: ReconciliationInput;
  /** Current local domain content, or null if localPresent is false. Required whenever the decision needs a payload to push (create/update) or a value to compare. */
  localContent: TContent | null;
  /** Current authoritative server content (from a reconciliation-only read), or null if server.kind is 'absent'. Used for ADOPT_SERVER's payload and content-equality checks. */
  serverContent: TContent | null;
  adapter: DomainAdapter<TContent>;
};

/**
 * `fresh`, when supplied, is the authoritative row an RPC's own 'conflict'
 * response just returned — strictly more current than `request.input.server`
 * (which reflects whatever the reconciliation read saw before the mutation
 * attempt, and may already be stale by the time the RPC actually ran).
 * Conflicts detected directly by the pure engine (no RPC attempted at all)
 * have no fresher source and fall back to `request.input.server`.
 */
function conflictDetail<TContent>(
  request: ExecutionRequest<TContent>,
  action: ReconciliationAction,
  reason: string,
  fresh?: { version: number | null; deletedAt: string | null },
): ConflictDetail {
  const currentServerVersion = fresh ? fresh.version : request.input.server.kind === 'absent' ? null : request.input.server.version;
  const currentServerDeleted = fresh ? fresh.deletedAt !== null : request.input.server.kind === 'tombstone';
  return {
    domain: request.domain,
    id: request.id,
    action,
    reason,
    acknowledgedBaseVersion: request.input.metadata?.lastSeenVersion ?? null,
    currentServerVersion,
    currentServerDeleted,
  };
}

async function applyPatchIfAny(domain: SyncDomain, id: string, patch: ReturnType<typeof decideReconciliation>['metadataPatch']): Promise<void> {
  if (patch === null) return;
  if (patch === 'remove') {
    await removeMetadata(domain, id);
    return;
  }
  await applyMetadataPatch(domain, id, patch);
}

/**
 * Carries out exactly one reconciliation decision for one identity. Always
 * computes the decision itself from `request.input` — see this file's
 * top-of-file note on why that's non-negotiable (§18).
 */
export async function executeReconciliation<TContent>(request: ExecutionRequest<TContent>): Promise<ExecutionOutcome> {
  const contentEquals =
    request.localContent !== null && request.serverContent !== null
      ? request.adapter.compareContent(request.localContent, request.serverContent)
      : undefined;
  const decision = decideReconciliation({ ...request.input, contentEquals });
  const { domain, id, adapter } = request;
  const baseVersion = request.input.metadata?.lastSeenVersion ?? null;

  switch (decision.action) {
    case 'NO_OP': {
      // Case J and the "tombstone goal already achieved" combinations can
      // carry a metadata-only refresh with no domain mutation at all — the
      // decision object is authoritative; the executor never recomputes
      // whether a refresh is warranted.
      try {
        await applyPatchIfAny(domain, id, decision.metadataPatch);
      } catch (error) {
        return { kind: 'operational_failure', action: decision.action, error };
      }
      return { kind: 'no_op', reason: decision.reason };
    }

    case 'ADOPT_SERVER': {
      if (request.serverContent === null) {
        return { kind: 'inconsistent_state', detail: `ADOPT_SERVER decided (${decision.reason}) but no serverContent was supplied.` };
      }
      // Ordering: persist the server payload FIRST, acknowledge metadata
      // only after it durably lands. If the process dies in between,
      // re-running recomputes this same ADOPT_SERVER decision from
      // unchanged facts and simply rewrites the same content again —
      // idempotent, no special repair path needed (§5).
      try {
        await adapter.writeLocal(id, request.serverContent);
      } catch (error) {
        return { kind: 'operational_failure', action: decision.action, error };
      }
      try {
        await applyPatchIfAny(domain, id, decision.metadataPatch);
      } catch (error) {
        // Local content is already correct; only the acknowledgement
        // failed. Safe to retry — re-running still lands on ADOPT_SERVER
        // (facts unchanged) and this time may succeed.
        return { kind: 'operational_failure', action: decision.action, error };
      }
      return { kind: 'success', action: decision.action, reason: decision.reason };
    }

    case 'DELETE_LOCAL': {
      // Ordering is the OPPOSITE of Phase 1B.1's local-user-delete
      // tombstone-first rule, deliberately: here the deletion intent
      // already exists authoritatively on the SERVER (we're just catching
      // up), not originating locally, so there is nothing local to protect
      // by acknowledging metadata first. Proven by recoverability, not
      // symmetry: if metadata were acknowledged FIRST and the process died
      // before the local object was actually removed, the next
      // reconciliation pass would see (metadata: isDeleted=true matching
      // the server, local: still present) — a state this engine's ordinary
      // matrix resolves as NO_OP (metadata and server already agree),
      // permanently stranding the local object with no further path to
      // remove it. Removing the local object FIRST instead means a
      // process-death-before-ack leaves (metadata: isDeleted=false/stale,
      // local: absent) — which Case M's drift-repair branch recognizes and
      // correctly re-derives DELETE_LOCAL's metadata patch from the same
      // server tombstone on the very next pass. Tested explicitly below.
      //
      // Skip the removal call entirely when the domain object is already
      // absent (exactly the state a Case M drift-repair re-derivation
      // finds itself in) — there is nothing left to remove, and calling
      // removeLocal anyway would be an unnecessary write for no benefit.
      if (request.input.localPresent) {
        try {
          await adapter.removeLocal(id);
        } catch (error) {
          return { kind: 'operational_failure', action: decision.action, error };
        }
      }
      try {
        await applyPatchIfAny(domain, id, decision.metadataPatch);
      } catch (error) {
        return { kind: 'operational_failure', action: decision.action, error };
      }
      return { kind: 'success', action: decision.action, reason: decision.reason };
    }

    case 'CREATE_SERVER': {
      if (request.localContent === null) {
        return { kind: 'inconsistent_state', detail: `CREATE_SERVER decided (${decision.reason}) but no localContent was supplied.` };
      }
      let result: RpcMutationResult<TContent>;
      try {
        result = await adapter.createServer(id, request.localContent);
      } catch (error) {
        return { kind: 'operational_failure', action: decision.action, error };
      }
      if (result.status === 'created') {
        try {
          await applyMetadataPatch(domain, id, { lastSeenVersion: result.version, isDeleted: false, isDirty: false });
        } catch (error) {
          return { kind: 'operational_failure', action: decision.action, error };
        }
        return { kind: 'success', action: decision.action, reason: decision.reason };
      }
      // 'create_conflict': never treated as failure, never silently
      // overwritten. Return the authoritative current state so the
      // orchestration boundary re-decides — see this file's Case K2 note
      // above; the engine itself now recognizes a content match as this
      // device's own earlier success, so a single redecide converges
      // rather than looping.
      return {
        kind: 'redecide_required',
        reason: decision.reason,
        server: result.version === null ? { kind: 'absent' } : result.deletedAt !== null ? { kind: 'tombstone', version: result.version } : { kind: 'active', version: result.version },
        content: result.content,
      };
    }

    case 'UPDATE_SERVER':
    case 'REACTIVATE_SERVER': {
      if (baseVersion === null) {
        return { kind: 'inconsistent_state', detail: `${decision.action} decided (${decision.reason}) with no baseVersion in metadata.` };
      }
      if (request.localContent === null) {
        return { kind: 'inconsistent_state', detail: `${decision.action} decided (${decision.reason}) but no localContent was supplied.` };
      }
      let result: RpcMutationResult<TContent>;
      try {
        result = await adapter.updateServer(id, baseVersion, request.localContent);
      } catch (error) {
        return { kind: 'operational_failure', action: decision.action, error };
      }
      if (result.status === 'applied') {
        try {
          await applyMetadataPatch(domain, id, { lastSeenVersion: result.version, isDeleted: false, isDirty: false });
        } catch (error) {
          return { kind: 'operational_failure', action: decision.action, error };
        }
        return { kind: 'success', action: decision.action, reason: decision.reason };
      }
      if (result.status === 'conflict') {
        // Phase 2A §I: distinguish a genuine foreign conflict from this
        // device's own earlier CAS success whose acknowledgement was lost
        // (app died between the RPC succeeding and metadata being stored;
        // the retry reuses the now-stale baseVersion and gets 'conflict').
        // Never substitute a freshly-observed version to force the update
        // through — that would bypass CAS entirely, exactly what §18
        // forbids.
        const recovered = result.content !== null && adapter.compareContent(result.content, request.localContent);
        if (recovered && result.version !== null) {
          try {
            await applyMetadataPatch(domain, id, { lastSeenVersion: result.version, isDeleted: result.deletedAt !== null, isDirty: false });
          } catch (error) {
            return { kind: 'operational_failure', action: decision.action, error };
          }
          return { kind: 'success', action: decision.action, reason: `${decision.reason}-recovered-lost-ack` };
        }
        return { kind: 'conflict', detail: conflictDetail(request, decision.action, decision.reason, { version: result.version, deletedAt: result.deletedAt }) };
      }
      // 'not_found': the row vanished entirely (compatibility-era hard
      // delete) between the read that produced this decision and now.
      return { kind: 'redecide_required', reason: decision.reason, server: { kind: 'absent' }, content: null };
    }

    case 'DELETE_SERVER': {
      if (baseVersion === null) {
        return { kind: 'inconsistent_state', detail: `DELETE_SERVER decided (${decision.reason}) with no baseVersion in metadata.` };
      }
      let result: RpcMutationResult<TContent>;
      try {
        result = await adapter.deleteServer(id, baseVersion);
      } catch (error) {
        return { kind: 'operational_failure', action: decision.action, error };
      }
      if (result.status === 'applied') {
        try {
          await applyMetadataPatch(domain, id, { lastSeenVersion: result.version, isDeleted: true, isDirty: false });
        } catch (error) {
          return { kind: 'operational_failure', action: decision.action, error };
        }
        return { kind: 'success', action: decision.action, reason: decision.reason };
      }
      if (result.status === 'conflict') {
        if (result.deletedAt !== null) {
          // Already tombstoned — our delete goal is already achieved,
          // whether by an earlier attempt of our own or someone else's.
          // Adopt the authoritative tombstone version; never re-issue
          // another delete against it.
          try {
            await applyMetadataPatch(domain, id, { lastSeenVersion: result.version, isDeleted: true, isDirty: false });
          } catch (error) {
            return { kind: 'operational_failure', action: decision.action, error };
          }
          return { kind: 'success', action: decision.action, reason: `${decision.reason}-already-tombstoned` };
        }
        // Active with a changed version: this is exactly corrected Case
        // G's territory — the server-side change also represents real
        // user intent. Never upgrade to the newer version and retry the
        // delete; return conflict for explicit resolution.
        return { kind: 'conflict', detail: conflictDetail(request, decision.action, decision.reason, { version: result.version, deletedAt: result.deletedAt }) };
      }
      return { kind: 'redecide_required', reason: decision.reason, server: { kind: 'absent' }, content: null };
    }

    case 'CONFLICT': {
      return { kind: 'conflict', detail: conflictDetail(request, decision.action, decision.reason) };
    }

    case 'DEFER_UNKNOWN_LEGACY_STATE': {
      return { kind: 'deferred', reason: decision.reason };
    }

    case 'REPAIR_METADATA': {
      if (decision.metadataPatch !== 'remove') {
        return { kind: 'inconsistent_state', detail: `REPAIR_METADATA decided (${decision.reason}) with an unexpected non-'remove' patch — engine/executor contract mismatch.` };
      }
      try {
        await removeMetadata(domain, id);
      } catch (error) {
        return { kind: 'operational_failure', action: decision.action, error };
      }
      return { kind: 'success', action: decision.action, reason: decision.reason };
    }

    default: {
      const exhaustive: never = decision.action;
      return { kind: 'inconsistent_state', detail: `Unhandled action: ${exhaustive as string}` };
    }
  }
}
