import { describe, expect, it } from 'vitest';

import { decideReconciliation, type ReconciliationInput } from '@/lib/reconciliation-decision-engine';
import type { RecordSyncMetadata } from '@/lib/sync-metadata-storage';

// Exhaustive, table-driven proof of every case in
// docs/sync-phase2a-reconciliation-spec.md §C, plus every combination
// discovered while implementing the engine that the markdown spec didn't
// explicitly name. No AsyncStorage, no network, no mocks — decideReconciliation
// is a pure function, so every test is a direct input/output assertion.

function meta(partial: Partial<RecordSyncMetadata>): RecordSyncMetadata {
  return { lastSeenVersion: null, isDeleted: false, isDirty: false, ...partial };
}

describe('Case A — first observation', () => {
  it('local absent, no metadata, server active -> ADOPT_SERVER, acknowledges the version', () => {
    const result = decideReconciliation({ localPresent: false, metadata: null, server: { kind: 'active', version: 1 } });
    expect(result).toEqual({ action: 'ADOPT_SERVER', metadataPatch: { lastSeenVersion: 1, isDeleted: false, isDirty: false }, reason: 'A-first-observation' });
  });
});

describe('Case B — everything already agrees', () => {
  it('local active, lastSeenVersion=N, server active@N, not dirty, content genuinely equal -> NO_OP', () => {
    const result = decideReconciliation({ localPresent: true, metadata: meta({ lastSeenVersion: 5 }), server: { kind: 'active', version: 5 }, contentEquals: true });
    expect(result).toEqual({ action: 'NO_OP', metadataPatch: null, reason: 'B-agrees' });
  });
});

describe('Case C — server advanced, local unchanged', () => {
  it('not dirty, server ahead -> ADOPT_SERVER', () => {
    const result = decideReconciliation({ localPresent: true, metadata: meta({ lastSeenVersion: 5 }), server: { kind: 'active', version: 6 } });
    expect(result).toEqual({ action: 'ADOPT_SERVER', metadataPatch: { lastSeenVersion: 6, isDeleted: false, isDirty: false }, reason: 'C-server-advanced' });
  });
});

describe('Case D — local changed, server unchanged', () => {
  it('dirty, server still at lastSeenVersion -> UPDATE_SERVER, no pre-computed metadata (depends on the RPC response)', () => {
    const result = decideReconciliation({ localPresent: true, metadata: meta({ lastSeenVersion: 5, isDirty: true }), server: { kind: 'active', version: 5 } });
    expect(result).toEqual({ action: 'UPDATE_SERVER', metadataPatch: null, reason: 'D-local-changed-server-unchanged' });
  });
});

describe('Case E — both changed (real conflict)', () => {
  it('dirty, server ahead -> CONFLICT, never resolved automatically', () => {
    const result = decideReconciliation({ localPresent: true, metadata: meta({ lastSeenVersion: 5, isDirty: true }), server: { kind: 'active', version: 6 } });
    expect(result).toEqual({ action: 'CONFLICT', metadataPatch: null, reason: 'E-both-changed' });
  });
});

describe('Case F — local intentional delete, server unchanged', () => {
  it('tombstoned+dirty, server still active at lastSeenVersion -> DELETE_SERVER', () => {
    const result = decideReconciliation({ localPresent: false, metadata: meta({ lastSeenVersion: 5, isDeleted: true, isDirty: true }), server: { kind: 'active', version: 5 } });
    expect(result).toEqual({ action: 'DELETE_SERVER', metadataPatch: null, reason: 'F-local-delete-server-unchanged' });
  });
});

describe('Case G — local delete, server changed afterward (real conflict)', () => {
  it('tombstoned+dirty, server ahead -> CONFLICT for every domain (corrected: never an automatic "deletion wins")', () => {
    const result = decideReconciliation({ localPresent: false, metadata: meta({ lastSeenVersion: 5, isDeleted: true, isDirty: true }), server: { kind: 'active', version: 6 } });
    expect(result).toEqual({ action: 'CONFLICT', metadataPatch: null, reason: 'G-local-delete-server-changed' });
  });
});

describe('Case H — server deleted, local unchanged', () => {
  it('not dirty, not deleted locally, server now tombstoned ahead -> DELETE_LOCAL', () => {
    const result = decideReconciliation({ localPresent: true, metadata: meta({ lastSeenVersion: 5 }), server: { kind: 'tombstone', version: 6 } });
    expect(result).toEqual({ action: 'DELETE_LOCAL', metadataPatch: { lastSeenVersion: 6, isDeleted: true, isDirty: false }, reason: 'H-server-deleted-local-unchanged' });
  });
});

describe('Case I — server deleted, local locally edited (real conflict)', () => {
  it('dirty, not deleted, server tombstoned ahead -> CONFLICT', () => {
    const result = decideReconciliation({ localPresent: true, metadata: meta({ lastSeenVersion: 5, isDirty: true }), server: { kind: 'tombstone', version: 6 } });
    expect(result).toEqual({ action: 'CONFLICT', metadataPatch: null, reason: 'I-server-deleted-local-edited' });
  });
});

describe('Case J — both independently deleted', () => {
  it('tombstoned, not dirty, server tombstone at the exact same version -> NO_OP, no metadata change', () => {
    const result = decideReconciliation({ localPresent: false, metadata: meta({ lastSeenVersion: 5, isDeleted: true }), server: { kind: 'tombstone', version: 5 } });
    expect(result).toEqual({ action: 'NO_OP', metadataPatch: null, reason: 'J-both-deleted-agree' });
  });

  it('tombstoned, not dirty, server tombstone AHEAD (M > N) -> NO_OP but metadata refreshes to the current version', () => {
    const result = decideReconciliation({ localPresent: false, metadata: meta({ lastSeenVersion: 5, isDeleted: true }), server: { kind: 'tombstone', version: 9 } });
    expect(result).toEqual({ action: 'NO_OP', metadataPatch: { lastSeenVersion: 9, isDeleted: true, isDirty: false }, reason: 'J-both-deleted-server-ahead' });
  });
});

describe('Case K1 vs Case K2 — the core "cannot resurrect a legacy hard delete" proof (explicitly required regression test)', () => {
  it('K1: legacy record, NO metadata at all, server absent -> DEFER_UNKNOWN_LEGACY_STATE, never CREATE_SERVER', () => {
    const result = decideReconciliation({ localPresent: true, metadata: null, server: { kind: 'absent' } });
    expect(result.action).toBe('DEFER_UNKNOWN_LEGACY_STATE');
    expect(result.action).not.toBe('CREATE_SERVER');
  });

  it('K2: metadata PROVES this device created it (lastSeenVersion null, isDirty true), server absent -> CREATE_SERVER is safe', () => {
    const result = decideReconciliation({ localPresent: true, metadata: meta({ isDirty: true }), server: { kind: 'absent' } });
    expect(result).toEqual({ action: 'CREATE_SERVER', metadataPatch: null, reason: 'K2-known-local-creation' });
  });

  it('same local presence, same server absence — the ONLY difference between K1 and K2 is metadata provenance, and it changes the action from a safe no-op-until-resolved to an active push', () => {
    const k1 = decideReconciliation({ localPresent: true, metadata: null, server: { kind: 'absent' } });
    const k2 = decideReconciliation({ localPresent: true, metadata: meta({ isDirty: true }), server: { kind: 'absent' } });
    expect(k1.action).not.toBe(k2.action);
    expect(k1.action).toBe('DEFER_UNKNOWN_LEGACY_STATE');
    expect(k2.action).toBe('CREATE_SERVER');
  });
});

describe('Case K2 redecide-after-create_conflict (Phase 2B2 correction — prevents an infinite redecide loop)', () => {
  it('a fresh server read showing active content that MATCHES local -> recognizes this device\'s own earlier create as already-succeeded, adopts, does not retry CREATE_SERVER', () => {
    const result = decideReconciliation({ localPresent: true, metadata: meta({ isDirty: true }), server: { kind: 'active', version: 1 }, contentEquals: true });
    expect(result).toEqual({ action: 'ADOPT_SERVER', metadataPatch: { lastSeenVersion: 1, isDeleted: false, isDirty: false }, reason: 'K2-recognized-own-prior-create-success' });
  });

  it('a fresh server read showing active content that DIFFERS from local -> CONFLICT, a genuine cross-origin collision under the same id, never overwritten', () => {
    const result = decideReconciliation({ localPresent: true, metadata: meta({ isDirty: true }), server: { kind: 'active', version: 1 }, contentEquals: false });
    expect(result).toEqual({ action: 'CONFLICT', metadataPatch: null, reason: 'K2-collision-with-existing-active-content' });
  });

  it('a fresh server read showing a tombstone under this never-synced id -> CONFLICT, no automatic reactivation attempt', () => {
    const result = decideReconciliation({ localPresent: true, metadata: meta({ isDirty: true }), server: { kind: 'tombstone', version: 1 } });
    expect(result).toEqual({ action: 'CONFLICT', metadataPatch: null, reason: 'K2-collision-with-existing-tombstone' });
  });
});

describe('Case Q vs Case K1 — positive tombstone evidence changes the answer (explicitly required regression test)', () => {
  it('Q: legacy record (no metadata), server has a REAL tombstone -> DELETE_LOCAL is safe (positive proof, not mere absence)', () => {
    const result = decideReconciliation({ localPresent: true, metadata: null, server: { kind: 'tombstone', version: 3 } });
    expect(result).toEqual({ action: 'DELETE_LOCAL', metadataPatch: { lastSeenVersion: 3, isDeleted: true, isDirty: false }, reason: 'Q-legacy-positive-tombstone' });
  });

  it('same local presence, same lack of metadata — a real tombstone (Q) is actionable; mere absence (K1) is not', () => {
    const k1 = decideReconciliation({ localPresent: true, metadata: null, server: { kind: 'absent' } });
    const q = decideReconciliation({ localPresent: true, metadata: null, server: { kind: 'tombstone', version: 1 } });
    expect(k1.action).toBe('DEFER_UNKNOWN_LEGACY_STATE');
    expect(q.action).toBe('DELETE_LOCAL');
  });
});

describe('Case L — legacy local record, server active, no metadata', () => {
  it('content equal -> silently adopts (no conflict)', () => {
    const result = decideReconciliation({ localPresent: true, metadata: null, server: { kind: 'active', version: 2 }, contentEquals: true });
    expect(result).toEqual({ action: 'ADOPT_SERVER', metadataPatch: { lastSeenVersion: 2, isDeleted: false, isDirty: false }, reason: 'L-legacy-equal-adopt' });
  });

  it('content differs -> CONFLICT, never a guessed winner', () => {
    const result = decideReconciliation({ localPresent: true, metadata: null, server: { kind: 'active', version: 2 }, contentEquals: false });
    expect(result).toEqual({ action: 'CONFLICT', metadataPatch: null, reason: 'L-legacy-differs-conflict' });
  });
});

describe('Case M — metadata says active, domain object absent (internal drift)', () => {
  it('server active -> ADOPT_SERVER (re-materialize)', () => {
    const result = decideReconciliation({ localPresent: false, metadata: meta({ lastSeenVersion: 1 }), server: { kind: 'active', version: 4 } });
    expect(result).toEqual({ action: 'ADOPT_SERVER', metadataPatch: { lastSeenVersion: 4, isDeleted: false, isDirty: false }, reason: 'M-repair-adopt-active' });
  });

  it('server tombstone -> DELETE_LOCAL semantics (mark deleted, nothing to re-materialize)', () => {
    const result = decideReconciliation({ localPresent: false, metadata: meta({ lastSeenVersion: 1 }), server: { kind: 'tombstone', version: 4 } });
    expect(result).toEqual({ action: 'DELETE_LOCAL', metadataPatch: { lastSeenVersion: 4, isDeleted: true, isDirty: false }, reason: 'M-repair-mark-deleted' });
  });

  it('server absent -> REPAIR_METADATA, removes the now-pointless entry', () => {
    const result = decideReconciliation({ localPresent: false, metadata: meta({ lastSeenVersion: 1 }), server: { kind: 'absent' } });
    expect(result).toEqual({ action: 'REPAIR_METADATA', metadataPatch: 'remove', reason: 'M-repair-remove-metadata' });
  });

  it('Phase 2B1 refinement: drift WITH a known pending edit (isDirty) is a CONFLICT, not a silent repair — the original spec predates isDirty and would have silently discarded the edit', () => {
    const result = decideReconciliation({ localPresent: false, metadata: meta({ lastSeenVersion: 1, isDirty: true }), server: { kind: 'active', version: 4 } });
    expect(result).toEqual({ action: 'CONFLICT', metadataPatch: null, reason: 'M-drift-with-lost-dirty-edit' });
  });
});

describe('Case N — local-only create-then-delete, never synced', () => {
  it('server absent -> NO_OP, nothing to push, nothing to resurrect', () => {
    const result = decideReconciliation({ localPresent: false, metadata: meta({ isDeleted: true, isDirty: true }), server: { kind: 'absent' } });
    expect(result).toEqual({ action: 'NO_OP', metadataPatch: null, reason: 'N-local-only-create-then-delete' });
  });

  it('server unexpectedly has something under this never-synced id -> CONFLICT (cross-origin collision, no version history to act on)', () => {
    const result = decideReconciliation({ localPresent: false, metadata: meta({ isDeleted: true, isDirty: true }), server: { kind: 'active', version: 1 } });
    expect(result).toEqual({ action: 'CONFLICT', metadataPatch: null, reason: 'N-collision-no-sync-history' });
  });
});

describe('Case O — re-created previously-deleted record (deliberate reactivation)', () => {
  it('reactivated locally (isDeleted:false, dirty:true), server tombstone at the EXACT lastSeenVersion -> REACTIVATE_SERVER', () => {
    const result = decideReconciliation({ localPresent: true, metadata: meta({ lastSeenVersion: 5, isDirty: true }), server: { kind: 'tombstone', version: 5 } });
    expect(result).toEqual({ action: 'REACTIVATE_SERVER', metadataPatch: null, reason: 'O-deliberate-reactivation' });
  });
});

describe('Case P — never observed locally, server tombstoned', () => {
  it('NO_OP, no metadata created proactively', () => {
    const result = decideReconciliation({ localPresent: false, metadata: null, server: { kind: 'tombstone', version: 7 } });
    expect(result).toEqual({ action: 'NO_OP', metadataPatch: null, reason: 'P-never-observed-tombstoned' });
  });
});

describe('Case R / T — previously-synced record, server now absent (compatibility-era ambiguity)', () => {
  it('R: not dirty -> CONFLICT, never automatic DELETE_LOCAL nor automatic re-push', () => {
    const result = decideReconciliation({ localPresent: true, metadata: meta({ lastSeenVersion: 5 }), server: { kind: 'absent' } });
    expect(result).toEqual({ action: 'CONFLICT', metadataPatch: null, reason: 'R-unchanged-server-vanished' });
  });

  it('T: dirty -> CONFLICT, compounds with a pending edit', () => {
    const result = decideReconciliation({ localPresent: true, metadata: meta({ lastSeenVersion: 5, isDirty: true }), server: { kind: 'absent' } });
    expect(result).toEqual({ action: 'CONFLICT', metadataPatch: null, reason: 'T-pending-edit-server-vanished' });
  });
});

describe('Case V — version lineage reset (hard-delete/recreate detected), checked before every other case', () => {
  it('not dirty, not tombstoned, content equal to the new incarnation -> ADOPT_SERVER', () => {
    const result = decideReconciliation({ localPresent: true, metadata: meta({ lastSeenVersion: 10 }), server: { kind: 'active', version: 2 }, contentEquals: true });
    expect(result).toEqual({ action: 'ADOPT_SERVER', metadataPatch: { lastSeenVersion: 2, isDeleted: false, isDirty: false }, reason: 'V-not-dirty-equal-adopt' });
  });

  it('not dirty, not tombstoned, content differs from the new incarnation -> CONFLICT', () => {
    const result = decideReconciliation({ localPresent: true, metadata: meta({ lastSeenVersion: 10 }), server: { kind: 'active', version: 2 }, contentEquals: false });
    expect(result).toEqual({ action: 'CONFLICT', metadataPatch: null, reason: 'V-not-dirty-differs-conflict' });
  });

  it('not dirty, not tombstoned, no local domain object at all -> ADOPT_SERVER unconditionally (nothing local to protect)', () => {
    const result = decideReconciliation({ localPresent: false, metadata: meta({ lastSeenVersion: 10 }), server: { kind: 'active', version: 2 } });
    expect(result).toEqual({ action: 'ADOPT_SERVER', metadataPatch: { lastSeenVersion: 2, isDeleted: false, isDirty: false }, reason: 'V-not-dirty-no-local-adopt' });
  });

  it('dirty (pending edit assumed against the now-dead lineage) -> CONFLICT, never applied against the new incarnation via CAS', () => {
    const result = decideReconciliation({ localPresent: true, metadata: meta({ lastSeenVersion: 10, isDirty: true }), server: { kind: 'active', version: 2 } });
    expect(result).toEqual({ action: 'CONFLICT', metadataPatch: null, reason: 'V-dirty-lineage-reset' });
  });

  it('tombstoned locally (delete intent targeted the old, now-gone lineage) -> CONFLICT, never silently decided either way for the new incarnation', () => {
    const result = decideReconciliation({ localPresent: false, metadata: meta({ lastSeenVersion: 10, isDeleted: true }), server: { kind: 'active', version: 2 } });
    expect(result).toEqual({ action: 'CONFLICT', metadataPatch: null, reason: 'V-tombstoned-lineage-reset' });
  });

  it('takes priority over Case B: even though local looks "synced" by ordinary comparison, a lower server version is never treated as agreement', () => {
    // Same local/metadata shape as the Case B test above, but the server
    // version is LOWER than lastSeenVersion — must route to Case V, not B.
    const result = decideReconciliation({ localPresent: true, metadata: meta({ lastSeenVersion: 5 }), server: { kind: 'active', version: 1 }, contentEquals: true });
    expect(result.reason).toMatch(/^V-/);
    expect(result.reason).not.toBe('B-agrees');
  });
});

describe('Discovered during implementation — tombstone (isDeleted:true) vs. an absent server', () => {
  it('dirty tombstone, server absent -> NO_OP, clears isDirty (goal already achieved by someone/something else)', () => {
    const result = decideReconciliation({ localPresent: false, metadata: meta({ lastSeenVersion: 5, isDeleted: true, isDirty: true }), server: { kind: 'absent' } });
    expect(result).toEqual({ action: 'NO_OP', metadataPatch: { isDirty: false }, reason: 'tombstone-goal-achieved-absent' });
  });

  it('already-settled tombstone (not dirty), server absent -> NO_OP, no metadata change needed', () => {
    const result = decideReconciliation({ localPresent: false, metadata: meta({ lastSeenVersion: 5, isDeleted: true }), server: { kind: 'absent' } });
    expect(result).toEqual({ action: 'NO_OP', metadataPatch: null, reason: 'settled-tombstone-server-vanished' });
  });

  it('already-settled tombstone (not dirty), server now shows ACTIVE (reactivated elsewhere) -> ADOPT_SERVER, not treated as forbidden resurrection', () => {
    const result = decideReconciliation({ localPresent: false, metadata: meta({ lastSeenVersion: 5, isDeleted: true }), server: { kind: 'active', version: 8 } });
    expect(result).toEqual({ action: 'ADOPT_SERVER', metadataPatch: { lastSeenVersion: 8, isDeleted: false, isDirty: false }, reason: 'settled-tombstone-reactivated-elsewhere' });
  });
});

describe('Determinism and idempotence spot-checks (invariants B.6/B.7)', () => {
  it('the same input always produces the same output (determinism)', () => {
    const input: ReconciliationInput = { localPresent: true, metadata: meta({ lastSeenVersion: 5, isDirty: true }), server: { kind: 'active', version: 5 } };
    const first = decideReconciliation(input);
    const second = decideReconciliation({ ...input });
    expect(first).toEqual(second);
  });

  it('NO_OP cases never propose a metadata change that would alter a stable state (Case B, Case J-agree)', () => {
    expect(decideReconciliation({ localPresent: true, metadata: meta({ lastSeenVersion: 5 }), server: { kind: 'active', version: 5 }, contentEquals: true }).metadataPatch).toBeNull();
    expect(decideReconciliation({ localPresent: false, metadata: meta({ lastSeenVersion: 5, isDeleted: true }), server: { kind: 'tombstone', version: 5 } }).metadataPatch).toBeNull();
  });
});

describe('Phase 3B — same-version legacy compatibility drift', () => {
  // A legacy write can change content without incrementing sync_version
  // (every legacy upsert path across all four domains confirmed to omit
  // sync_version/deleted_at from its payload entirely — see
  // docs/sync-phase2a-reconciliation-spec.md's Phase 3B section). These
  // cases prove `cmp === 'same'` is no longer treated as sufficient proof
  // of state equality on its own, for both the clean and dirty halves of
  // the matrix, across every domain shape (document and slot alike — the
  // engine itself is domain-agnostic, so one table-driven suite covers all
  // four sync-project domains identically).

  describe('clean local, server same version', () => {
    it('content genuinely equal -> NO_OP (unchanged Case B behavior)', () => {
      const result = decideReconciliation({ localPresent: true, metadata: meta({ lastSeenVersion: 9 }), server: { kind: 'active', version: 9 }, contentEquals: true });
      expect(result).toEqual({ action: 'NO_OP', metadataPatch: null, reason: 'B-agrees' });
    });

    it('content DIFFERS despite the same version -> ADOPT_SERVER, preserving the same authoritative version (a legacy mutation, not a real conflict — nothing local is at risk since local is clean)', () => {
      const result = decideReconciliation({ localPresent: true, metadata: meta({ lastSeenVersion: 9 }), server: { kind: 'active', version: 9 }, contentEquals: false });
      expect(result).toEqual({ action: 'ADOPT_SERVER', metadataPatch: { lastSeenVersion: 9, isDeleted: false, isDirty: false }, reason: 'B-same-version-content-drift-adopt' });
    });

    it('contentEquals omitted entirely (unknown) -> treated the same as "differs", never assumed equal without positive proof', () => {
      const result = decideReconciliation({ localPresent: true, metadata: meta({ lastSeenVersion: 9 }), server: { kind: 'active', version: 9 } });
      expect(result.action).toBe('ADOPT_SERVER');
      expect(result.reason).toBe('B-same-version-content-drift-adopt');
    });
  });

  describe('dirty local, server same version', () => {
    it('content already matches the local pending edit -> NO_OP, acknowledges lastSeenVersion and clears isDirty without any CAS mutation', () => {
      const result = decideReconciliation({ localPresent: true, metadata: meta({ lastSeenVersion: 9, isDirty: true }), server: { kind: 'active', version: 9 }, contentEquals: true });
      expect(result).toEqual({ action: 'NO_OP', metadataPatch: { lastSeenVersion: 9, isDeleted: false, isDirty: false }, reason: 'D-same-version-already-matches-adopt' });
    });

    it('content differs -> UPDATE_SERVER (unchanged Case D behavior) — this is the one half of the matrix client-side detection cannot fully close (see file-level comment), pending a server-side compatibility bridge', () => {
      const result = decideReconciliation({ localPresent: true, metadata: meta({ lastSeenVersion: 9, isDirty: true }), server: { kind: 'active', version: 9 }, contentEquals: false });
      expect(result).toEqual({ action: 'UPDATE_SERVER', metadataPatch: null, reason: 'D-local-changed-server-unchanged' });
    });

    it('contentEquals omitted entirely (unknown) -> falls back to the existing UPDATE_SERVER behavior, never a regression for callers that do not supply it', () => {
      const result = decideReconciliation({ localPresent: true, metadata: meta({ lastSeenVersion: 9, isDirty: true }), server: { kind: 'active', version: 9 } });
      expect(result).toEqual({ action: 'UPDATE_SERVER', metadataPatch: null, reason: 'D-local-changed-server-unchanged' });
    });
  });

  describe('same numeric version, deletion state differs (compatibility-era anomaly, explicitly handled)', () => {
    it('local acknowledged ACTIVE@N (clean), server is a TOMBSTONE@N -> DELETE_LOCAL (Case H\'s existing defensive handling, not silently treated as ordinary Case B agreement)', () => {
      const result = decideReconciliation({ localPresent: true, metadata: meta({ lastSeenVersion: 9 }), server: { kind: 'tombstone', version: 9 } });
      expect(result).toEqual({ action: 'DELETE_LOCAL', metadataPatch: { lastSeenVersion: 9, isDeleted: true, isDirty: false }, reason: 'H-server-deleted-local-unchanged' });
    });

    it('local acknowledged TOMBSTONE@N (clean, settled), server is ACTIVE@N -> ADOPT_SERVER (treated as a reactivation elsewhere, safe because local has no pending intent of its own to protect)', () => {
      const result = decideReconciliation({ localPresent: false, metadata: meta({ lastSeenVersion: 9, isDeleted: true }), server: { kind: 'active', version: 9 } });
      expect(result).toEqual({ action: 'ADOPT_SERVER', metadataPatch: { lastSeenVersion: 9, isDeleted: false, isDirty: false }, reason: 'settled-tombstone-reactivated-elsewhere' });
    });
  });
});
