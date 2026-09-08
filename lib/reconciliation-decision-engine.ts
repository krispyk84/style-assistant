import type { RecordSyncMetadata } from '@/lib/sync-metadata-storage';

// Phase 2B1 (sync redesign) — the pure decision engine specified in
// docs/sync-phase2a-reconciliation-spec.md §C/§D. Given the local domain
// object's presence, this client's sync metadata, and an authoritative
// (tombstone-inclusive) server read for one identity, decides exactly one
// of a finite set of actions — and nothing more. This module does NOT:
//   - read or write AsyncStorage
//   - call any network/RPC
//   - apply its own metadataPatch anywhere
// It is a pure function of its inputs, by design, so every case in the
// spec can be tested as a plain table without mocking anything. The
// execution layer that actually calls the Phase 1A RPCs and applies
// metadataPatch is explicitly NOT built in this phase (see the spec's §K
// implementation sequence, step 5).

export type ReconciliationAction =
  | 'NO_OP'
  | 'ADOPT_SERVER'
  | 'CREATE_SERVER'
  | 'UPDATE_SERVER'
  | 'DELETE_SERVER'
  | 'REACTIVATE_SERVER'
  | 'DELETE_LOCAL'
  | 'CONFLICT'
  | 'REPAIR_METADATA'
  | 'DEFER_UNKNOWN_LEGACY_STATE';

export type ServerState =
  | { kind: 'absent' }
  | { kind: 'active'; version: number }
  | { kind: 'tombstone'; version: number };

export type ReconciliationInput = {
  /** Does the domain object exist in this device's own local storage right now? */
  localPresent: boolean;
  /** This device's sync metadata for the identity, or `null` if it has never been stamped (true legacy — predates Phase 1B/2B metadata entirely). */
  metadata: RecordSyncMetadata | null;
  /** A tombstone-inclusive, version-carrying server read for the same identity (§F). */
  server: ServerState;
  /**
   * Only consulted when a case actually needs a content-equality check
   * (Case L, and Case V's not-dirty/not-deleted sub-row). Omit when not
   * applicable — the engine never invents an equality result.
   */
  contentEquals?: boolean;
};

export type ReconciliationResult = {
  action: ReconciliationAction;
  /**
   * What SHOULD be written to sync metadata if/when this action's local
   * effect is applied — this engine does not apply it. `null` means no
   * metadata change is part of this decision (e.g. CONFLICT, or an action
   * whose metadata effect depends on a response this engine hasn't seen,
   * like CREATE_SERVER/UPDATE_SERVER/DELETE_SERVER/REACTIVATE_SERVER,
   * whose actual resulting version is only known once the RPC responds —
   * that's the execution layer's job, not this one's).
   * `'remove'` (only for REPAIR_METADATA) means the metadata entry itself
   * should be erased (removeMetadata), not patched.
   */
  metadataPatch: Partial<RecordSyncMetadata> | 'remove' | null;
  /** Which case (or discovered-during-implementation combination) fired — for tests and debugging, not a stable public contract. */
  reason: string;
};

function adopt(version: number, isDeleted: boolean, reason: string): ReconciliationResult {
  return { action: 'ADOPT_SERVER', metadataPatch: { lastSeenVersion: version, isDeleted, isDirty: false }, reason };
}

function conflict(reason: string): ReconciliationResult {
  return { action: 'CONFLICT', metadataPatch: null, reason };
}

export function decideReconciliation(input: ReconciliationInput): ReconciliationResult {
  const { localPresent, metadata, server, contentEquals } = input;

  // ── Case V: version lineage reset — checked FIRST, before every other
  // case, since a hard-delete/recreate cycle (possible while legacy
  // clients remain live, §A.3) invalidates the ordinary stale-vs-current
  // comparison every case below assumes. ──────────────────────────────
  if (
    metadata &&
    metadata.lastSeenVersion !== null &&
    server.kind !== 'absent' &&
    server.version < metadata.lastSeenVersion
  ) {
    if (metadata.isDeleted) {
      return conflict('V-tombstoned-lineage-reset');
    }
    if (metadata.isDirty) {
      return conflict('V-dirty-lineage-reset');
    }
    // Not dirty, not deleted: local's claim was tied to the now-destroyed
    // lineage. Treat as a fresh first observation of the new incarnation.
    if (!localPresent) {
      return adopt(server.version, server.kind === 'tombstone', 'V-not-dirty-no-local-adopt');
    }
    if (contentEquals) {
      return adopt(server.version, server.kind === 'tombstone', 'V-not-dirty-equal-adopt');
    }
    return conflict('V-not-dirty-differs-conflict');
  }

  // ── Case M: metadata says active (not a tombstone), but the domain
  // object is verifiably absent locally — internal drift, not a normal
  // sync state (see the spec's Case M for the realistic trigger: a bulk
  // replaceSavedOutfits/replaceWeekPlan overwriting the whole local array
  // without going through markDeleted for this specific id). Checked
  // before the ordinary matrix below because it's a repair path, not a
  // steady-state case. ──────────────────────────────────────────────────
  if (metadata && !metadata.isDeleted && !localPresent) {
    // Phase 2B1 refinement beyond the original spec (written before
    // isDirty existed as an implemented field): if a pending local edit
    // was known (isDirty) and the domain object is now ALSO gone, blindly
    // repairing from the server would silently discard a known pending
    // change — that's a real conflict, not a repair.
    if (metadata.isDirty) {
      return conflict('M-drift-with-lost-dirty-edit');
    }
    if (server.kind === 'active') {
      return adopt(server.version, false, 'M-repair-adopt-active');
    }
    if (server.kind === 'tombstone') {
      return { action: 'DELETE_LOCAL', metadataPatch: { lastSeenVersion: server.version, isDeleted: true, isDirty: false }, reason: 'M-repair-mark-deleted' };
    }
    return { action: 'REPAIR_METADATA', metadataPatch: 'remove', reason: 'M-repair-remove-metadata' };
  }

  // ── Metadata completely absent: true legacy (predates any Phase 1B+
  // aware write to this identity) or a genuinely first-ever observation. ──
  if (!metadata) {
    if (!localPresent) {
      if (server.kind === 'absent') return { action: 'NO_OP', metadataPatch: null, reason: 'nothing-anywhere' };
      if (server.kind === 'tombstone') return { action: 'NO_OP', metadataPatch: null, reason: 'P-never-observed-tombstoned' };
      return adopt(server.version, false, 'A-first-observation');
    }
    // localPresent && !metadata
    if (server.kind === 'absent') {
      // Corrected from this spec's first draft: NOT an automatic
      // CREATE_SERVER (§A.3) — a legacy client may have physically
      // deleted this identity with no trace, and ancestry cannot be
      // established from absence alone.
      return { action: 'DEFER_UNKNOWN_LEGACY_STATE', metadataPatch: null, reason: 'K1-unknown-ancestry' };
    }
    if (server.kind === 'tombstone') {
      // Positive proof of intentional deletion, unlike mere absence —
      // safe to remove the stale local copy regardless of this device's
      // own (nonexistent) history with it.
      return { action: 'DELETE_LOCAL', metadataPatch: { lastSeenVersion: server.version, isDeleted: true, isDirty: false }, reason: 'Q-legacy-positive-tombstone' };
    }
    // server.kind === 'active' — Case L.
    if (contentEquals) {
      return adopt(server.version, false, 'L-legacy-equal-adopt');
    }
    return conflict('L-legacy-differs-conflict');
  }

  // ── Metadata present from here on. lastSeenVersion === null implies
  // isDirty === true (the only way to reach null is a brand-new
  // markActive/markDeleted call; the only way to clear isDirty is
  // setLastSeenVersion, which always sets a real version) — this is a
  // structural invariant of sync-metadata-storage.ts's own transition
  // rules, not an assumption made here. ────────────────────────────────
  const { lastSeenVersion, isDeleted, isDirty } = metadata;

  if (lastSeenVersion === null) {
    if (!isDeleted) {
      // Case K2: this device knows it created this record itself and has
      // never synced it.
      //
      // Phase 2B2 correction: the original Phase 2B1 comment here reasoned
      // that CREATE_SERVER is "safe regardless of what the server read
      // shows" because the create RPC's own create_conflict handling is
      // the safety net. That is true for a ONE-SHOT call, but process-death
      // testing during Phase 2B2 (§16: "server create succeeds, ack lost,
      // retry") proved it insufficient for the ORCHESTRATION LOOP: after a
      // create_conflict, the executor re-fetches server state and asks this
      // engine to re-decide — and since this branch previously ignored
      // server state entirely, it would emit CREATE_SERVER again against
      // the exact same now-existing row, forever (an infinite redecide
      // loop, never converging). Fixed by actually consulting the fresh
      // server read here, the same way Case L/lost-ack recovery already
      // does: if the server unexpectedly already has content, recognize a
      // content match as this device's own earlier create having already
      // succeeded (adopt, clear dirty) rather than retrying blindly; a
      // content mismatch is a genuine cross-origin collision under this
      // exact id, which cannot be resolved automatically.
      if (server.kind === 'absent') {
        return { action: 'CREATE_SERVER', metadataPatch: null, reason: 'K2-known-local-creation' };
      }
      if (server.kind === 'active') {
        return contentEquals
          ? adopt(server.version, false, 'K2-recognized-own-prior-create-success')
          : conflict('K2-collision-with-existing-active-content');
      }
      // server.kind === 'tombstone' — this exact id is already claimed and
      // deleted under a lineage this device has zero prior relationship to
      // (lastSeenVersion was null); no safe automatic action.
      return conflict('K2-collision-with-existing-tombstone');
    }
    // isDeleted && lastSeenVersion === null: created and deleted locally
    // without ever syncing (Case N, generalized — the spec's own notation
    // never restricted N to be non-null).
    if (server.kind === 'absent') {
      return { action: 'NO_OP', metadataPatch: null, reason: 'N-local-only-create-then-delete' };
    }
    // Server has *something* under an id this device never synced — a
    // cross-origin collision with zero version history to act on safely.
    return conflict('N-collision-no-sync-history');
  }

  // From here, lastSeenVersion is a real number and server, if it exists,
  // has version >= lastSeenVersion (Case V already handled the opposite).
  const cmp = server.kind === 'absent' ? 'absent' : server.version === lastSeenVersion ? 'same' : 'ahead';

  if (!isDeleted) {
    if (isDirty) {
      if (server.kind === 'absent') return conflict('T-pending-edit-server-vanished');
      if (server.kind === 'active') {
        return cmp === 'same'
          ? { action: 'UPDATE_SERVER', metadataPatch: null, reason: 'D-local-changed-server-unchanged' }
          : conflict('E-both-changed');
      }
      // server.kind === 'tombstone'
      return cmp === 'same'
        ? { action: 'REACTIVATE_SERVER', metadataPatch: null, reason: 'O-deliberate-reactivation' }
        : conflict('I-server-deleted-local-edited');
    }
    // not dirty
    if (server.kind === 'absent') return conflict('R-unchanged-server-vanished');
    if (server.kind === 'active') {
      return cmp === 'same'
        ? { action: 'NO_OP', metadataPatch: null, reason: 'B-agrees' }
        : adopt(server.version, false, 'C-server-advanced');
    }
    // server.kind === 'tombstone', not dirty, isDeleted false: cmp==='same'
    // here would mean a delete happened without incrementing the version,
    // which Phase 1A's protocol never does — defensively treated the same
    // as 'ahead' rather than assumed impossible.
    return { action: 'DELETE_LOCAL', metadataPatch: { lastSeenVersion: server.version, isDeleted: true, isDirty: false }, reason: 'H-server-deleted-local-unchanged' };
  }

  // isDeleted === true — our own tombstone.
  if (isDirty) {
    if (server.kind === 'absent') {
      // Discovered during implementation, not explicitly named in the
      // markdown spec: our deletion goal is already achieved (hard-deleted
      // by someone, matching our intent) — nothing left to push.
      return { action: 'NO_OP', metadataPatch: { isDirty: false }, reason: 'tombstone-goal-achieved-absent' };
    }
    if (server.kind === 'tombstone') {
      // Also already achieved (by us or someone else) — converge metadata.
      return { action: 'NO_OP', metadataPatch: { lastSeenVersion: server.version, isDeleted: true, isDirty: false }, reason: 'tombstone-goal-achieved-tombstoned' };
    }
    // server.kind === 'active'
    return cmp === 'same'
      ? { action: 'DELETE_SERVER', metadataPatch: null, reason: 'F-local-delete-server-unchanged' }
      : conflict('G-local-delete-server-changed');
  }

  // not dirty: our tombstone was already fully acknowledged at some
  // earlier point.
  if (server.kind === 'absent') {
    // Discovered during implementation: an already-settled tombstone has
    // since vanished entirely server-side — still matches our intent.
    return { action: 'NO_OP', metadataPatch: null, reason: 'settled-tombstone-server-vanished' };
  }
  if (server.kind === 'tombstone') {
    return cmp === 'same'
      ? { action: 'NO_OP', metadataPatch: null, reason: 'J-both-deleted-agree' }
      : { action: 'NO_OP', metadataPatch: { lastSeenVersion: server.version, isDeleted: true, isDirty: false }, reason: 'J-both-deleted-server-ahead' };
  }
  // server.kind === 'active': someone reactivated it after our tombstone
  // was fully settled. We have no pending claim of our own (not dirty) —
  // this is not "resurrecting a deletion we intended" (invariant B.2 is
  // about THIS engine spontaneously undoing a local tombstone; it does
  // not forbid adopting a DIFFERENT device's already-authoritative,
  // properly-CAS-guarded reactivation when we have nothing of our own to
  // protect), so this is the same shape as Case C.
  return adopt(server.version, false, 'settled-tombstone-reactivated-elsewhere');
}
