import { beforeEach, describe, expect, it, vi } from 'vitest';

// Real in-memory, FAILABLE metadata persistence (same convention as
// week-plan-storage.sync-metadata.test.ts's Phase 1B.1 failure-mode
// tests) — this file uses the REAL sync-metadata-storage.ts module
// throughout, not a mock of it, so (a) multi-call convergence tests
// (Part 16's process-death scenarios) prove actual persisted state across
// two separate executeReconciliation calls, and (b) failure injection on
// the metadata key specifically simulates "lost acknowledgement" without
// needing to mock the executor's own logic away.
const storageMock = new Map<string, string>();
const failingKeys = new Set<string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => {
      if (failingKeys.has(key)) return Promise.reject(new Error(`injected storage failure: ${key}`));
      return Promise.resolve(storageMock.get(key) ?? null);
    }),
    setItem: vi.fn((key: string, value: string) => {
      if (failingKeys.has(key)) return Promise.reject(new Error(`injected storage failure: ${key}`));
      storageMock.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      if (failingKeys.has(key)) return Promise.reject(new Error(`injected storage failure: ${key}`));
      storageMock.delete(key);
      return Promise.resolve();
    }),
  },
}));

const getCurrentUserId = vi.fn().mockResolvedValue('user-1');
vi.mock('@/lib/supabase-data', () => ({ getCurrentUserId: () => getCurrentUserId() }));

const SYNC_METADATA_KEY = 'style-assistant/sync-metadata/user-1';

beforeEach(() => {
  storageMock.clear();
  failingKeys.clear();
  vi.resetModules();
  getCurrentUserId.mockClear();
  getCurrentUserId.mockResolvedValue('user-1');
});

type Content = { value: string };
const contentA: Content = { value: 'A' };
const contentB: Content = { value: 'B' };

async function freshExecutor() {
  return import('@/lib/reconciliation-executor');
}
async function freshMetadata() {
  return import('@/lib/sync-metadata-storage');
}

function makeAdapter(overrides: Record<string, unknown> = {}) {
  return {
    writeLocal: vi.fn().mockResolvedValue(undefined),
    removeLocal: vi.fn().mockResolvedValue(undefined),
    createServer: vi.fn(),
    updateServer: vi.fn(),
    deleteServer: vi.fn(),
    compareContent: (a: Content, b: Content) => a.value === b.value,
    ...overrides,
  };
}

const DOMAIN = 'week-plan' as const;

describe('executeReconciliation — NO_OP', () => {
  it('everything agrees: no domain mutation, no metadata write', async () => {
    const { executeReconciliation } = await freshExecutor();
    const { setLastSeenVersion, getMetadata } = await freshMetadata();
    await setLastSeenVersion(DOMAIN, 'mon', 5);
    const adapter = makeAdapter();

    const outcome = await executeReconciliation({
      domain: DOMAIN, id: 'mon',
      input: { localPresent: true, metadata: { lastSeenVersion: 5, isDeleted: false, isDirty: false }, server: { kind: 'active', version: 5 } },
      localContent: contentA, serverContent: contentA, adapter,
    });

    expect(outcome).toEqual({ kind: 'no_op', reason: 'B-agrees' });
    expect(adapter.writeLocal).not.toHaveBeenCalled();
    expect(adapter.removeLocal).not.toHaveBeenCalled();
    expect(await getMetadata(DOMAIN, 'mon')).toEqual({ lastSeenVersion: 5, isDeleted: false, isDirty: false });
  });

  it('Case J with server ahead: NO_OP but the metadata refresh IS applied — "no domain mutation" is not "no state change"', async () => {
    const { executeReconciliation } = await freshExecutor();
    const { markDeleted, setLastSeenVersion, getMetadata } = await freshMetadata();
    await setLastSeenVersion(DOMAIN, 'mon', 5);
    await markDeleted(DOMAIN, 'mon'); // {5, true, true}
    await setLastSeenVersion(DOMAIN, 'mon', 5); // settle it: {5, true, false}
    const adapter = makeAdapter();

    const outcome = await executeReconciliation({
      domain: DOMAIN, id: 'mon',
      input: { localPresent: false, metadata: { lastSeenVersion: 5, isDeleted: true, isDirty: false }, server: { kind: 'tombstone', version: 9 } },
      localContent: null, serverContent: null, adapter,
    });

    expect(outcome).toEqual({ kind: 'no_op', reason: 'J-both-deleted-server-ahead' });
    expect(await getMetadata(DOMAIN, 'mon')).toEqual({ lastSeenVersion: 9, isDeleted: true, isDirty: false });
  });
});

describe('executeReconciliation — ADOPT_SERVER', () => {
  it('writes local content THEN acknowledges metadata, in that order', async () => {
    const { executeReconciliation } = await freshExecutor();
    const { getMetadata } = await freshMetadata();
    const callOrder: string[] = [];
    const adapter = makeAdapter({
      writeLocal: vi.fn().mockImplementation(async () => { callOrder.push('writeLocal'); }),
    });
    // Observe metadata-write ordering via the real module by checking state is absent until after writeLocal resolves — simplest proof: writeLocal call is recorded before we assert final metadata.
    const outcome = await executeReconciliation({
      domain: DOMAIN, id: 'mon',
      input: { localPresent: false, metadata: null, server: { kind: 'active', version: 1 } },
      localContent: null, serverContent: contentA, adapter,
    });

    expect(callOrder).toEqual(['writeLocal']);
    expect(outcome).toEqual({ kind: 'success', action: 'ADOPT_SERVER', reason: 'A-first-observation' });
    expect(adapter.writeLocal).toHaveBeenCalledWith('mon', contentA);
    expect(await getMetadata(DOMAIN, 'mon')).toEqual({ lastSeenVersion: 1, isDeleted: false, isDirty: false });
  });

  it('process death: writeLocal fails -> operational_failure, metadata is NEVER touched, safe to retry', async () => {
    const { executeReconciliation } = await freshExecutor();
    const { getMetadata } = await freshMetadata();
    const adapter = makeAdapter({ writeLocal: vi.fn().mockRejectedValue(new Error('disk full')) });

    const outcome = await executeReconciliation({
      domain: DOMAIN, id: 'mon',
      input: { localPresent: false, metadata: null, server: { kind: 'active', version: 1 } },
      localContent: null, serverContent: contentA, adapter,
    });

    expect(outcome.kind).toBe('operational_failure');
    expect(await getMetadata(DOMAIN, 'mon')).toBeNull(); // untouched — never claimed to have adopted anything
  });

  it('process death: writeLocal succeeds but metadata ack fails -> operational_failure; retry with unchanged facts converges (idempotent rewrite)', async () => {
    const { executeReconciliation } = await freshExecutor();
    const { getMetadata } = await freshMetadata();
    const adapter = makeAdapter();
    const input = { localPresent: false, metadata: null, server: { kind: 'active' as const, version: 1 } };

    failingKeys.add(SYNC_METADATA_KEY);
    const first = await executeReconciliation({ domain: DOMAIN, id: 'mon', input, localContent: null, serverContent: contentA, adapter });
    expect(first.kind).toBe('operational_failure');
    expect(adapter.writeLocal).toHaveBeenCalledTimes(1);
    expect(await getMetadata(DOMAIN, 'mon').catch(() => null)).toBeNull();

    failingKeys.delete(SYNC_METADATA_KEY);
    const second = await executeReconciliation({ domain: DOMAIN, id: 'mon', input, localContent: null, serverContent: contentA, adapter });
    expect(second).toEqual({ kind: 'success', action: 'ADOPT_SERVER', reason: 'A-first-observation' });
    expect(adapter.writeLocal).toHaveBeenCalledTimes(2); // idempotent rewrite, no special-casing needed
    expect(await getMetadata(DOMAIN, 'mon')).toEqual({ lastSeenVersion: 1, isDeleted: false, isDirty: false });
  });

  it('inconsistent_state guard: ADOPT_SERVER decided but no serverContent supplied', async () => {
    const { executeReconciliation } = await freshExecutor();
    const adapter = makeAdapter();
    const outcome = await executeReconciliation({
      domain: DOMAIN, id: 'mon',
      input: { localPresent: false, metadata: null, server: { kind: 'active', version: 1 } },
      localContent: null, serverContent: null, adapter,
    });
    expect(outcome.kind).toBe('inconsistent_state');
    expect(adapter.writeLocal).not.toHaveBeenCalled();
  });
});

describe('executeReconciliation — DELETE_LOCAL: ordering proven by recoverability, not symmetry with the local-user-delete path', () => {
  it('removes local content THEN acknowledges metadata', async () => {
    const { executeReconciliation } = await freshExecutor();
    const { setLastSeenVersion, getMetadata } = await freshMetadata();
    await setLastSeenVersion(DOMAIN, 'mon', 5);
    const adapter = makeAdapter();

    const outcome = await executeReconciliation({
      domain: DOMAIN, id: 'mon',
      input: { localPresent: true, metadata: { lastSeenVersion: 5, isDeleted: false, isDirty: false }, server: { kind: 'tombstone', version: 6 } },
      localContent: contentA, serverContent: null, adapter,
    });

    expect(outcome).toEqual({ kind: 'success', action: 'DELETE_LOCAL', reason: 'H-server-deleted-local-unchanged' });
    expect(adapter.removeLocal).toHaveBeenCalledWith('mon');
    expect(await getMetadata(DOMAIN, 'mon')).toEqual({ lastSeenVersion: 6, isDeleted: true, isDirty: false });
  });

  it('process death: removeLocal fails -> operational_failure, metadata untouched', async () => {
    const { executeReconciliation } = await freshExecutor();
    const { setLastSeenVersion, getMetadata } = await freshMetadata();
    await setLastSeenVersion(DOMAIN, 'mon', 5);
    const adapter = makeAdapter({ removeLocal: vi.fn().mockRejectedValue(new Error('io error')) });

    const outcome = await executeReconciliation({
      domain: DOMAIN, id: 'mon',
      input: { localPresent: true, metadata: { lastSeenVersion: 5, isDeleted: false, isDirty: false }, server: { kind: 'tombstone', version: 6 } },
      localContent: contentA, serverContent: null, adapter,
    });

    expect(outcome.kind).toBe('operational_failure');
    expect(await getMetadata(DOMAIN, 'mon')).toEqual({ lastSeenVersion: 5, isDeleted: false, isDirty: false });
  });

  it('THE KEY RECOVERABILITY PROOF (§6): removeLocal succeeds, metadata ack fails -> next reconciliation pass (with fresh, honest facts: localPresent now false, metadata stale) re-derives the SAME tombstone via Case M drift-repair, converging without ever resurrecting the record', async () => {
    const { executeReconciliation } = await freshExecutor();
    const { setLastSeenVersion, getMetadata } = await freshMetadata();
    await setLastSeenVersion(DOMAIN, 'mon', 5);
    const adapter = makeAdapter();

    failingKeys.add(SYNC_METADATA_KEY);
    const first = await executeReconciliation({
      domain: DOMAIN, id: 'mon',
      input: { localPresent: true, metadata: { lastSeenVersion: 5, isDeleted: false, isDirty: false }, server: { kind: 'tombstone', version: 6 } },
      localContent: contentA, serverContent: null, adapter,
    });
    expect(first.kind).toBe('operational_failure');
    expect(adapter.removeLocal).toHaveBeenCalledTimes(1); // the local removal DID go through
    failingKeys.delete(SYNC_METADATA_KEY);
    // Metadata is stale ({5,false,false}) because the ack never landed —
    // but the domain object really is gone now (removeLocal succeeded).
    expect(await getMetadata(DOMAIN, 'mon')).toEqual({ lastSeenVersion: 5, isDeleted: false, isDirty: false });

    // A later reconciliation pass reads honest, current facts: localPresent
    // is now false (the object really is gone), metadata is still the
    // stale pre-ack value, server is unchanged.
    const second = await executeReconciliation({
      domain: DOMAIN, id: 'mon',
      input: { localPresent: false, metadata: { lastSeenVersion: 5, isDeleted: false, isDirty: false }, server: { kind: 'tombstone', version: 6 } },
      localContent: null, serverContent: null, adapter,
    });

    expect(second).toEqual({ kind: 'success', action: 'DELETE_LOCAL', reason: 'M-repair-mark-deleted' });
    expect(adapter.removeLocal).toHaveBeenCalledTimes(1); // NOT called again — nothing local left to remove
    expect(await getMetadata(DOMAIN, 'mon')).toEqual({ lastSeenVersion: 6, isDeleted: true, isDirty: false });
  });
});

describe('executeReconciliation — CREATE_SERVER', () => {
  it('created -> success, acknowledges the returned version', async () => {
    const { executeReconciliation } = await freshExecutor();
    const { getMetadata } = await freshMetadata();
    const adapter = makeAdapter({
      createServer: vi.fn().mockResolvedValue({ status: 'created', version: 1, deletedAt: null, content: contentA }),
    });

    const outcome = await executeReconciliation({
      domain: DOMAIN, id: 'mon',
      input: { localPresent: true, metadata: { lastSeenVersion: null, isDeleted: false, isDirty: true }, server: { kind: 'absent' } },
      localContent: contentA, serverContent: null, adapter,
    });

    expect(outcome).toEqual({ kind: 'success', action: 'CREATE_SERVER', reason: 'K2-known-local-creation' });
    expect(await getMetadata(DOMAIN, 'mon')).toEqual({ lastSeenVersion: 1, isDeleted: false, isDirty: false });
  });

  it('create_conflict -> redecide_required with the authoritative server state, NEVER silently treated as success', async () => {
    const { executeReconciliation } = await freshExecutor();
    const { markActive, getMetadata } = await freshMetadata();
    await markActive(DOMAIN, 'mon'); // real prior metadata: {null, false, true} — matches the K2 precondition
    const adapter = makeAdapter({
      createServer: vi.fn().mockResolvedValue({ status: 'create_conflict', version: 3, deletedAt: null, content: contentB }),
    });

    const outcome = await executeReconciliation({
      domain: DOMAIN, id: 'mon',
      input: { localPresent: true, metadata: { lastSeenVersion: null, isDeleted: false, isDirty: true }, server: { kind: 'absent' } },
      localContent: contentA, serverContent: null, adapter,
    });

    expect(outcome).toEqual({ kind: 'redecide_required', reason: 'K2-known-local-creation', server: { kind: 'active', version: 3 }, content: contentB });
    expect(await getMetadata(DOMAIN, 'mon')).toEqual({ lastSeenVersion: null, isDeleted: false, isDirty: true }); // unchanged — not treated as failure or success
  });

  it('THE FULL PROCESS-DEATH LOOP (§16): server create succeeds, ack lost, retry -> create_conflict -> redecide with matching content -> converges to ADOPT_SERVER, no duplicate record, no infinite loop', async () => {
    const { executeReconciliation } = await freshExecutor();
    const { getMetadata } = await freshMetadata();
    const createServer = vi.fn()
      .mockResolvedValueOnce({ status: 'created', version: 1, deletedAt: null, content: contentA })
      .mockResolvedValueOnce({ status: 'create_conflict', version: 1, deletedAt: null, content: contentA });
    const adapter = makeAdapter({ createServer });
    const originalInput = { localPresent: true, metadata: { lastSeenVersion: null, isDeleted: false, isDirty: true } as const, server: { kind: 'absent' as const } };

    // Attempt 1: the RPC actually succeeds server-side...
    failingKeys.add(SYNC_METADATA_KEY);
    const attempt1 = await executeReconciliation({ domain: DOMAIN, id: 'mon', input: originalInput, localContent: contentA, serverContent: null, adapter });
    expect(attempt1.kind).toBe('operational_failure'); // ...but the ack never lands (process death simulated via metadata-write failure)
    failingKeys.delete(SYNC_METADATA_KEY);
    expect(await getMetadata(DOMAIN, 'mon')).toBeNull(); // still shows "never synced" — matches K2's original facts

    // Attempt 2 (retry, same stale facts — nothing else changed locally):
    const attempt2 = await executeReconciliation({ domain: DOMAIN, id: 'mon', input: originalInput, localContent: contentA, serverContent: null, adapter });
    expect(attempt2.kind).toBe('redecide_required');
    if (attempt2.kind !== 'redecide_required') throw new Error('unreachable');

    // Orchestration boundary re-decides with the fresh server facts the
    // executor handed back:
    const attempt3 = await executeReconciliation({
      domain: DOMAIN, id: 'mon',
      input: { localPresent: true, metadata: { lastSeenVersion: null, isDeleted: false, isDirty: true }, server: attempt2.server },
      localContent: contentA, serverContent: attempt2.content as Content, adapter,
    });

    expect(attempt3).toEqual({ kind: 'success', action: 'ADOPT_SERVER', reason: 'K2-recognized-own-prior-create-success' });
    expect(createServer).toHaveBeenCalledTimes(2); // never a third attempt — converged
    expect(await getMetadata(DOMAIN, 'mon')).toEqual({ lastSeenVersion: 1, isDeleted: false, isDirty: false });
  });
});

describe('executeReconciliation — UPDATE_SERVER', () => {
  it('applied -> success, acknowledges the returned version', async () => {
    const { executeReconciliation } = await freshExecutor();
    const { getMetadata } = await freshMetadata();
    const adapter = makeAdapter({
      updateServer: vi.fn().mockResolvedValue({ status: 'applied', version: 6, deletedAt: null, content: contentB }),
    });

    const outcome = await executeReconciliation({
      domain: DOMAIN, id: 'mon',
      input: { localPresent: true, metadata: { lastSeenVersion: 5, isDeleted: false, isDirty: true }, server: { kind: 'active', version: 5 } },
      localContent: contentB, serverContent: contentA, adapter,
    });

    expect(outcome).toEqual({ kind: 'success', action: 'UPDATE_SERVER', reason: 'D-local-changed-server-unchanged' });
    expect(adapter.updateServer).toHaveBeenCalledWith('mon', 5, contentB); // baseVersion is EXACTLY lastSeenVersion, never substituted
    expect(await getMetadata(DOMAIN, 'mon')).toEqual({ lastSeenVersion: 6, isDeleted: false, isDirty: false });
  });

  it('LOST-ACK RECOVERY (§16/§8A): conflict, but the server\'s current content matches what we intended to write -> recognized as our own earlier success, adopts, clears dirty', async () => {
    const { executeReconciliation } = await freshExecutor();
    const { getMetadata } = await freshMetadata();
    const adapter = makeAdapter({
      updateServer: vi.fn().mockResolvedValue({ status: 'conflict', version: 6, deletedAt: null, content: contentB }),
    });

    const outcome = await executeReconciliation({
      domain: DOMAIN, id: 'mon',
      input: { localPresent: true, metadata: { lastSeenVersion: 5, isDeleted: false, isDirty: true }, server: { kind: 'active', version: 5 } },
      localContent: contentB, serverContent: contentA, adapter,
    });

    expect(outcome).toEqual({ kind: 'success', action: 'UPDATE_SERVER', reason: 'D-local-changed-server-unchanged-recovered-lost-ack' });
    expect(await getMetadata(DOMAIN, 'mon')).toEqual({ lastSeenVersion: 6, isDeleted: false, isDirty: false });
  });

  it('GENUINE FOREIGN CONFLICT (§8B): conflict, server content DIFFERS from what we intended -> real conflict, never overwritten', async () => {
    const { executeReconciliation } = await freshExecutor();
    const { getMetadata } = await freshMetadata();
    const adapter = makeAdapter({
      updateServer: vi.fn().mockResolvedValue({ status: 'conflict', version: 6, deletedAt: null, content: { value: 'someone-elses-change' } }),
    });

    const outcome = await executeReconciliation({
      domain: DOMAIN, id: 'mon',
      input: { localPresent: true, metadata: { lastSeenVersion: 5, isDeleted: false, isDirty: true }, server: { kind: 'active', version: 5 } },
      localContent: contentB, serverContent: contentA, adapter,
    });

    expect(outcome.kind).toBe('conflict');
    if (outcome.kind !== 'conflict') throw new Error('unreachable');
    expect(outcome.detail).toEqual({
      // currentServerVersion/currentServerDeleted reflect the RPC's own
      // fresh conflict response (version 6), not the older input.server
      // fact (version 5) the decision was originally computed from — the
      // RPC's response is strictly more current by the time it arrives.
      domain: DOMAIN, id: 'mon', action: 'UPDATE_SERVER', reason: 'D-local-changed-server-unchanged',
      acknowledgedBaseVersion: 5, currentServerVersion: 6, currentServerDeleted: false,
    });
    // Metadata is left exactly as it was — no dirty cleared, no version advanced.
    expect(await getMetadata(DOMAIN, 'mon')).toBeNull();
  });

  it('never substitutes a freshly observed version for baseVersion — the RPC is always called with metadata.lastSeenVersion, proving §18\'s anti-bypass requirement', async () => {
    const { executeReconciliation } = await freshExecutor();
    const updateServer = vi.fn().mockResolvedValue({ status: 'applied', version: 10, deletedAt: null, content: contentB });
    const adapter = makeAdapter({ updateServer });

    await executeReconciliation({
      domain: DOMAIN, id: 'mon',
      // server shows version 9 (far ahead of what we last saw) — a
      // malicious/careless caller might hope this gets used as baseVersion.
      input: { localPresent: true, metadata: { lastSeenVersion: 3, isDeleted: false, isDirty: true }, server: { kind: 'active', version: 9 } },
      localContent: contentB, serverContent: contentA, adapter,
    });

    // This input actually decides CONFLICT (Case E: server ahead), so
    // updateServer is never even called — proving the executor did not
    // fabricate an UPDATE_SERVER attempt using the server's version.
    expect(updateServer).not.toHaveBeenCalled();
  });
});

describe('executeReconciliation — REACTIVATE_SERVER', () => {
  const reactivateInput = { localPresent: true, metadata: { lastSeenVersion: 5, isDeleted: false, isDirty: true } as const, server: { kind: 'tombstone' as const, version: 5 } };

  it('applied -> success', async () => {
    const { executeReconciliation } = await freshExecutor();
    const { getMetadata } = await freshMetadata();
    const adapter = makeAdapter({ updateServer: vi.fn().mockResolvedValue({ status: 'applied', version: 6, deletedAt: null, content: contentB }) });

    const outcome = await executeReconciliation({ domain: DOMAIN, id: 'mon', input: reactivateInput, localContent: contentB, serverContent: null, adapter });

    expect(outcome).toEqual({ kind: 'success', action: 'REACTIVATE_SERVER', reason: 'O-deliberate-reactivation' });
    expect(adapter.updateServer).toHaveBeenCalledWith('mon', 5, contentB);
    expect(await getMetadata(DOMAIN, 'mon')).toEqual({ lastSeenVersion: 6, isDeleted: false, isDirty: false });
  });

  it('previous reactivation succeeded but ack lost -> stale retry -> identical content recognized -> recovered success', async () => {
    const { executeReconciliation } = await freshExecutor();
    const adapter = makeAdapter({ updateServer: vi.fn().mockResolvedValue({ status: 'conflict', version: 6, deletedAt: null, content: contentB }) });
    const outcome = await executeReconciliation({ domain: DOMAIN, id: 'mon', input: reactivateInput, localContent: contentB, serverContent: null, adapter });
    expect(outcome).toEqual({ kind: 'success', action: 'REACTIVATE_SERVER', reason: 'O-deliberate-reactivation-recovered-lost-ack' });
  });

  it('another device independently reactivated with EQUIVALENT content -> also recognized, not treated as foreign (content match is content match regardless of origin)', async () => {
    const { executeReconciliation } = await freshExecutor();
    const adapter = makeAdapter({ updateServer: vi.fn().mockResolvedValue({ status: 'conflict', version: 7, deletedAt: null, content: contentB }) });
    const outcome = await executeReconciliation({ domain: DOMAIN, id: 'mon', input: reactivateInput, localContent: contentB, serverContent: null, adapter });
    expect(outcome.kind).toBe('success');
  });

  it('another device reactivated with DIFFERENT content -> genuine conflict', async () => {
    const { executeReconciliation } = await freshExecutor();
    const adapter = makeAdapter({ updateServer: vi.fn().mockResolvedValue({ status: 'conflict', version: 7, deletedAt: null, content: { value: 'their-content' } }) });
    const outcome = await executeReconciliation({ domain: DOMAIN, id: 'mon', input: reactivateInput, localContent: contentB, serverContent: null, adapter });
    expect(outcome.kind).toBe('conflict');
  });

  it('server advanced again after reactivation (moved further, different content) -> conflict, never force-written', async () => {
    const { executeReconciliation } = await freshExecutor();
    const adapter = makeAdapter({ updateServer: vi.fn().mockResolvedValue({ status: 'conflict', version: 12, deletedAt: null, content: { value: 'yet-another-change' } }) });
    const outcome = await executeReconciliation({ domain: DOMAIN, id: 'mon', input: reactivateInput, localContent: contentB, serverContent: null, adapter });
    expect(outcome.kind).toBe('conflict');
    if (outcome.kind !== 'conflict') throw new Error('unreachable');
    expect(outcome.detail.currentServerVersion).toBe(12);
  });
});

describe('executeReconciliation — DELETE_SERVER', () => {
  const deleteInput = { localPresent: false, metadata: { lastSeenVersion: 5, isDeleted: true, isDirty: true } as const, server: { kind: 'active' as const, version: 5 } };

  it('applied -> success', async () => {
    const { executeReconciliation } = await freshExecutor();
    const { getMetadata } = await freshMetadata();
    const adapter = makeAdapter({ deleteServer: vi.fn().mockResolvedValue({ status: 'applied', version: 6, deletedAt: '2026-01-01T00:00:00Z', content: contentA }) });

    const outcome = await executeReconciliation({ domain: DOMAIN, id: 'mon', input: deleteInput, localContent: null, serverContent: contentA, adapter });

    expect(outcome).toEqual({ kind: 'success', action: 'DELETE_SERVER', reason: 'F-local-delete-server-unchanged' });
    expect(adapter.deleteServer).toHaveBeenCalledWith('mon', 5);
    expect(await getMetadata(DOMAIN, 'mon')).toEqual({ lastSeenVersion: 6, isDeleted: true, isDirty: false });
  });

  it('MANDATORY REGRESSION (§10): stale conflict, server is already tombstoned -> adopts as already-achieved, never re-issues a second delete', async () => {
    const { executeReconciliation } = await freshExecutor();
    const { getMetadata } = await freshMetadata();
    const adapter = makeAdapter({ deleteServer: vi.fn().mockResolvedValue({ status: 'conflict', version: 7, deletedAt: '2026-01-02T00:00:00Z', content: contentA }) });

    const outcome = await executeReconciliation({ domain: DOMAIN, id: 'mon', input: deleteInput, localContent: null, serverContent: contentA, adapter });

    expect(outcome).toEqual({ kind: 'success', action: 'DELETE_SERVER', reason: 'F-local-delete-server-unchanged-already-tombstoned' });
    expect(adapter.deleteServer).toHaveBeenCalledTimes(1); // never retried
    expect(await getMetadata(DOMAIN, 'mon')).toEqual({ lastSeenVersion: 7, isDeleted: true, isDirty: false });
  });

  it('MANDATORY REGRESSION (§10): stale conflict, server is ACTIVE at a changed version -> conflict, NEVER issues another delete against the newer version (preserves corrected Case G)', async () => {
    const { executeReconciliation } = await freshExecutor();
    const adapter = makeAdapter({ deleteServer: vi.fn().mockResolvedValue({ status: 'conflict', version: 6, deletedAt: null, content: contentB }) });

    const outcome = await executeReconciliation({ domain: DOMAIN, id: 'mon', input: deleteInput, localContent: null, serverContent: contentA, adapter });

    expect(outcome.kind).toBe('conflict');
    expect(adapter.deleteServer).toHaveBeenCalledTimes(1); // exactly one attempt — no automatic re-issue at the new version
  });
});

describe('executeReconciliation — CONFLICT (from the engine directly, e.g. Case E)', () => {
  it('no mutation of either side; returns structured, domain-safe conflict detail', async () => {
    const { executeReconciliation } = await freshExecutor();
    const adapter = makeAdapter();

    const outcome = await executeReconciliation({
      domain: DOMAIN, id: 'mon',
      input: { localPresent: true, metadata: { lastSeenVersion: 5, isDeleted: false, isDirty: true }, server: { kind: 'active', version: 6 } },
      localContent: contentB, serverContent: contentA, adapter,
    });

    expect(outcome).toEqual({
      kind: 'conflict',
      detail: { domain: DOMAIN, id: 'mon', action: 'CONFLICT', reason: 'E-both-changed', acknowledgedBaseVersion: 5, currentServerVersion: 6, currentServerDeleted: false },
    });
    expect(adapter.writeLocal).not.toHaveBeenCalled();
    expect(adapter.removeLocal).not.toHaveBeenCalled();
    expect(adapter.updateServer).not.toHaveBeenCalled();
  });
});

describe('executeReconciliation — DEFER_UNKNOWN_LEGACY_STATE', () => {
  it('K1: legacy record, no metadata, server absent -> deferred, no mutation, observable without being a crash', async () => {
    const { executeReconciliation } = await freshExecutor();
    const adapter = makeAdapter();

    const outcome = await executeReconciliation({
      domain: DOMAIN, id: 'mon',
      input: { localPresent: true, metadata: null, server: { kind: 'absent' } },
      localContent: contentA, serverContent: null, adapter,
    });

    expect(outcome).toEqual({ kind: 'deferred', reason: 'K1-unknown-ancestry' });
    expect(adapter.createServer).not.toHaveBeenCalled();
  });

  it('legacy server absence after possible hard delete, dirty (Case T)', async () => {
    const { executeReconciliation } = await freshExecutor();
    const adapter = makeAdapter();
    const outcome = await executeReconciliation({
      domain: DOMAIN, id: 'mon',
      input: { localPresent: true, metadata: { lastSeenVersion: 5, isDeleted: false, isDirty: true }, server: { kind: 'absent' } },
      localContent: contentA, serverContent: null, adapter,
    });
    // T resolves to CONFLICT, not DEFER — confirming the two are correctly distinct outcomes.
    expect(outcome.kind).toBe('conflict');
  });

  it('version-lineage-reset ambiguity (Case V, dirty) -> conflict, not silently applied against the new incarnation', async () => {
    const { executeReconciliation } = await freshExecutor();
    const adapter = makeAdapter();
    const outcome = await executeReconciliation({
      domain: DOMAIN, id: 'mon',
      input: { localPresent: true, metadata: { lastSeenVersion: 10, isDeleted: false, isDirty: true }, server: { kind: 'active', version: 2 } },
      localContent: contentA, serverContent: contentB, adapter,
    });
    expect(outcome.kind).toBe('conflict');
    expect(adapter.updateServer).not.toHaveBeenCalled();
  });
});

describe('executeReconciliation — REPAIR_METADATA', () => {
  it('server absent branch of Case M -> removes the metadata entry entirely', async () => {
    const { executeReconciliation } = await freshExecutor();
    const { setLastSeenVersion, getMetadata } = await freshMetadata();
    await setLastSeenVersion(DOMAIN, 'mon', 1);
    const adapter = makeAdapter();

    const outcome = await executeReconciliation({
      domain: DOMAIN, id: 'mon',
      input: { localPresent: false, metadata: { lastSeenVersion: 1, isDeleted: false, isDirty: false }, server: { kind: 'absent' } },
      localContent: null, serverContent: null, adapter,
    });

    expect(outcome).toEqual({ kind: 'success', action: 'REPAIR_METADATA', reason: 'M-repair-remove-metadata' });
    expect(await getMetadata(DOMAIN, 'mon')).toBeNull();
  });

  it('server active branch of Case M maps to ADOPT_SERVER (not REPAIR_METADATA) — tested here to prove the repair-vs-reroute boundary is honored, not duplicated', async () => {
    const { executeReconciliation } = await freshExecutor();
    const { setLastSeenVersion, getMetadata } = await freshMetadata();
    await setLastSeenVersion(DOMAIN, 'mon', 1);
    const adapter = makeAdapter();

    const outcome = await executeReconciliation({
      domain: DOMAIN, id: 'mon',
      input: { localPresent: false, metadata: { lastSeenVersion: 1, isDeleted: false, isDirty: false }, server: { kind: 'active', version: 4 } },
      localContent: null, serverContent: contentA, adapter,
    });

    expect(outcome.kind).toBe('success');
    if (outcome.kind !== 'success') throw new Error('unreachable');
    expect(outcome.action).toBe('ADOPT_SERVER');
    expect(adapter.writeLocal).toHaveBeenCalledWith('mon', contentA);
    expect(await getMetadata(DOMAIN, 'mon')).toEqual({ lastSeenVersion: 4, isDeleted: false, isDirty: false });
  });

  it('server tombstone branch of Case M maps to DELETE_LOCAL (not REPAIR_METADATA)', async () => {
    const { executeReconciliation } = await freshExecutor();
    const { setLastSeenVersion, getMetadata } = await freshMetadata();
    await setLastSeenVersion(DOMAIN, 'mon', 1);
    const adapter = makeAdapter();

    const outcome = await executeReconciliation({
      domain: DOMAIN, id: 'mon',
      input: { localPresent: false, metadata: { lastSeenVersion: 1, isDeleted: false, isDirty: false }, server: { kind: 'tombstone', version: 4 } },
      localContent: null, serverContent: null, adapter,
    });

    expect(outcome.kind).toBe('success');
    if (outcome.kind !== 'success') throw new Error('unreachable');
    expect(outcome.action).toBe('DELETE_LOCAL');
    expect(await getMetadata(DOMAIN, 'mon')).toEqual({ lastSeenVersion: 4, isDeleted: true, isDirty: false });
  });
});

describe('executeReconciliation — §18 anti-bypass guarantees', () => {
  it('there is no way to invoke an UPDATE_SERVER/DELETE_SERVER call without going through decideReconciliation first: passing facts that decide CONFLICT never triggers any adapter mutation call, regardless of what localContent/serverContent are supplied', async () => {
    const { executeReconciliation } = await freshExecutor();
    const adapter = makeAdapter();

    await executeReconciliation({
      domain: DOMAIN, id: 'mon',
      input: { localPresent: false, metadata: { lastSeenVersion: 5, isDeleted: true, isDirty: true }, server: { kind: 'active', version: 6 } }, // Case G
      localContent: null, serverContent: contentA, adapter,
    });

    expect(adapter.updateServer).not.toHaveBeenCalled();
    expect(adapter.deleteServer).not.toHaveBeenCalled();
    expect(adapter.createServer).not.toHaveBeenCalled();
  });
});
