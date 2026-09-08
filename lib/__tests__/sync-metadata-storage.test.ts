import { beforeEach, describe, expect, it, vi } from 'vitest';

// Real in-memory persistence boundary (Map-backed getItem/setItem/
// removeItem), same convention as lib/__tests__/supabase-data-contract.test.ts
// — a genuine key-value store, not per-call return-value stubs, so these
// tests actually exercise the read-modify-write cycle sync-metadata-storage.ts
// performs on every call, not just its call signatures.
const storageMock = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storageMock.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      storageMock.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      storageMock.delete(key);
      return Promise.resolve();
    }),
  },
}));

// Phase 1B.1: the module under test now resolves the current session's user
// id (via lib/supabase-data.ts's getCurrentUserId) to scope its storage key
// per-user. Controllable per-test so tests can exercise different/changing
// "current user" values without any real Supabase client or real timing.
const getCurrentUserIdMock = vi.fn<() => Promise<string | null>>();
vi.mock('@/lib/supabase-data', () => ({
  getCurrentUserId: () => getCurrentUserIdMock(),
}));

beforeEach(() => {
  storageMock.clear();
  vi.resetModules();
  getCurrentUserIdMock.mockReset();
  getCurrentUserIdMock.mockResolvedValue('user-1');
});

async function freshModule() {
  return import('@/lib/sync-metadata-storage');
}

describe('sync-metadata-storage — persistence', () => {
  it('setting metadata survives a fresh import of the module (simulates app restart / storage-wrapper re-instantiation)', async () => {
    const first = await freshModule();
    await first.setLastSeenVersion('saved-outfits', 'req-1:business', 3);

    vi.resetModules();
    const second = await freshModule();
    const metadata = await second.getMetadata('saved-outfits', 'req-1:business');

    expect(metadata).toEqual({ lastSeenVersion: 3, isDeleted: false, isDirty: false });
  });
});

describe('sync-metadata-storage — domain isolation', () => {
  it('the same record id in two different domains does not collide', async () => {
    const mod = await freshModule();
    await mod.setLastSeenVersion('saved-outfits', 'shared-id', 5);
    await mod.markDeleted('week-plan', 'shared-id');

    expect(await mod.getMetadata('saved-outfits', 'shared-id')).toEqual({ lastSeenVersion: 5, isDeleted: false, isDirty: false });
    expect(await mod.getMetadata('week-plan', 'shared-id')).toEqual({ lastSeenVersion: null, isDeleted: true, isDirty: true });
  });
});

describe('sync-metadata-storage — version semantics', () => {
  it('an id with no metadata at all has an explicitly unknown version, not 0', async () => {
    const mod = await freshModule();
    expect(await mod.getMetadata('saved-outfits', 'never-seen')).toBeNull();
  });

  it('storing version N returns N', async () => {
    const mod = await freshModule();
    await mod.setLastSeenVersion('week-plan', 'mon', 7);
    expect(await mod.getMetadata('week-plan', 'mon')).toEqual({ lastSeenVersion: 7, isDeleted: false, isDirty: false });
  });

  it('updating from N to N+1 behaves correctly', async () => {
    const mod = await freshModule();
    await mod.setLastSeenVersion('week-plan', 'mon', 7);
    await mod.setLastSeenVersion('week-plan', 'mon', 8);
    expect(await mod.getMetadata('week-plan', 'mon')).toEqual({ lastSeenVersion: 8, isDeleted: false, isDirty: false });
  });

  it('setLastSeenVersion never invents isDeleted: true — a version update alone does not create a tombstone', async () => {
    const mod = await freshModule();
    await mod.setLastSeenVersion('week-plan', 'mon', 1);
    expect((await mod.getMetadata('week-plan', 'mon'))?.isDeleted).toBe(false);
  });
});

describe('sync-metadata-storage — isDirty semantics (Phase 2B1)', () => {
  it('markActive always sets isDirty: true — a local write is always unsynced until acknowledged', async () => {
    const mod = await freshModule();
    await mod.markActive('saved-outfits', 'x');
    expect((await mod.getMetadata('saved-outfits', 'x'))?.isDirty).toBe(true);
  });

  it('markDeleted always sets isDirty: true — a pending deletion is itself an unsynced write', async () => {
    const mod = await freshModule();
    await mod.markDeleted('saved-outfits', 'x');
    expect((await mod.getMetadata('saved-outfits', 'x'))?.isDirty).toBe(true);
  });

  it('setLastSeenVersion always clears isDirty: false — incorporating an authoritative version means no longer dirty', async () => {
    const mod = await freshModule();
    await mod.markActive('saved-outfits', 'x');
    expect((await mod.getMetadata('saved-outfits', 'x'))?.isDirty).toBe(true);

    await mod.setLastSeenVersion('saved-outfits', 'x', 1);
    expect((await mod.getMetadata('saved-outfits', 'x'))?.isDirty).toBe(false);
  });

  it('a fresh markActive after an acknowledged sync re-dirties the record', async () => {
    const mod = await freshModule();
    await mod.markActive('week-plan', 'mon');
    await mod.setLastSeenVersion('week-plan', 'mon', 1);
    expect((await mod.getMetadata('week-plan', 'mon'))?.isDirty).toBe(false);

    await mod.markActive('week-plan', 'mon'); // user reassigned the day again
    expect(await mod.getMetadata('week-plan', 'mon')).toEqual({ lastSeenVersion: 1, isDeleted: false, isDirty: true });
  });
});

describe('sync-metadata-storage — tombstones', () => {
  it('marking a record deleted preserves its already-known lastSeenVersion', async () => {
    const mod = await freshModule();
    await mod.setLastSeenVersion('saved-outfits', 'req-1:business', 4);
    await mod.markDeleted('saved-outfits', 'req-1:business');
    expect(await mod.getMetadata('saved-outfits', 'req-1:business')).toEqual({ lastSeenVersion: 4, isDeleted: true, isDirty: true });
  });

  it('a record with no prior metadata can still be marked deleted (lastSeenVersion stays null, not invented)', async () => {
    const mod = await freshModule();
    await mod.markDeleted('saved-outfits', 'req-2:casual');
    expect(await mod.getMetadata('saved-outfits', 'req-2:casual')).toEqual({ lastSeenVersion: null, isDeleted: true, isDirty: true });
  });

  it('deletion metadata survives independently of the domain object — this module has no notion of the domain object at all, proving the tombstone cannot be tied to it', async () => {
    const mod = await freshModule();
    await mod.markDeleted('week-plan', 'mon');
    // No domain-object storage was ever touched here; the tombstone exists purely in this module.
    expect(await mod.getMetadata('week-plan', 'mon')).toEqual({ lastSeenVersion: null, isDeleted: true, isDirty: true });
  });

  it('a tombstone survives a fresh import of the module (storage reload)', async () => {
    const first = await freshModule();
    await first.markDeleted('week-plan', 'mon');

    vi.resetModules();
    const second = await freshModule();
    expect(await second.getMetadata('week-plan', 'mon')).toEqual({ lastSeenVersion: null, isDeleted: true, isDirty: true });
  });
});

describe('sync-metadata-storage — re-creation (tombstone reuse)', () => {
  it('a tombstoned record can intentionally become active again via markActive', async () => {
    const mod = await freshModule();
    await mod.markDeleted('week-plan', 'mon');
    await mod.markActive('week-plan', 'mon');
    expect((await mod.getMetadata('week-plan', 'mon'))?.isDeleted).toBe(false);
  });

  it('re-creation PRESERVES lastSeenVersion rather than erasing it — required so a future CAS-based reactivation update can submit the tombstone\'s actual last-known version as baseVersion', async () => {
    const mod = await freshModule();
    await mod.setLastSeenVersion('week-plan', 'mon', 2);
    await mod.markDeleted('week-plan', 'mon'); // still 2, now tombstoned
    await mod.markActive('week-plan', 'mon'); // reassigned by the user

    expect(await mod.getMetadata('week-plan', 'mon')).toEqual({ lastSeenVersion: 2, isDeleted: false, isDirty: true });
  });

  it('re-creating an id that was never previously observed from the server leaves lastSeenVersion null (nothing to preserve, nothing invented)', async () => {
    const mod = await freshModule();
    await mod.markDeleted('week-plan', 'tue'); // local-only delete, never synced, lastSeenVersion stays null
    await mod.markActive('week-plan', 'tue');
    expect(await mod.getMetadata('week-plan', 'tue')).toEqual({ lastSeenVersion: null, isDeleted: false, isDirty: true });
  });

  it('markActive on a brand-new id (never deleted, never seen) does not fabricate a version', async () => {
    const mod = await freshModule();
    await mod.markActive('saved-outfits', 'brand-new');
    expect(await mod.getMetadata('saved-outfits', 'brand-new')).toEqual({ lastSeenVersion: null, isDeleted: false, isDirty: true });
  });
});

describe('sync-metadata-storage — legacy state (no fabricated history)', () => {
  it('an id that predates this phase (no metadata written yet) is null, never 0', async () => {
    const mod = await freshModule();
    const metadata = await mod.getMetadata('saved-outfits', 'pre-existing-record');
    expect(metadata).toBeNull();
    expect(metadata).not.toEqual({ lastSeenVersion: 0, isDeleted: false, isDirty: false });
  });

  it('a malformed/unrecognized persisted shape (e.g. wrong schemaVersion) is treated as absent, not crashed on or guessed at', async () => {
    storageMock.set('style-assistant/sync-metadata/user-1', JSON.stringify({ schemaVersion: 999, domains: { 'saved-outfits': { x: { lastSeenVersion: 1, isDeleted: false, isDirty: false } } } }));
    const mod = await freshModule();
    expect(await mod.getMetadata('saved-outfits', 'x')).toBeNull();
  });

  it('a persisted schemaVersion:1 shape (predates the Phase 2B1 isDirty field) is treated as absent, not guessed at — nothing has ever shipped with that shape, so this is purely a defensive proof of the evolution strategy', async () => {
    storageMock.set('style-assistant/sync-metadata/user-1', JSON.stringify({ schemaVersion: 1, domains: { 'saved-outfits': { x: { lastSeenVersion: 1, isDeleted: false } } } }));
    const mod = await freshModule();
    expect(await mod.getMetadata('saved-outfits', 'x')).toBeNull();
  });

  it('corrupted JSON is treated as absent rather than throwing', async () => {
    storageMock.set('style-assistant/sync-metadata/user-1', '{not valid json');
    const mod = await freshModule();
    expect(await mod.getMetadata('saved-outfits', 'x')).toBeNull();
    // and it doesn't blow up on a subsequent write either
    await mod.setLastSeenVersion('saved-outfits', 'x', 1);
    expect(await mod.getMetadata('saved-outfits', 'x')).toEqual({ lastSeenVersion: 1, isDeleted: false, isDirty: false });
  });
});

describe('sync-metadata-storage — getDomainMetadata / removeMetadata', () => {
  it('getDomainMetadata returns every record for one domain only', async () => {
    const mod = await freshModule();
    await mod.setLastSeenVersion('week-plan', 'mon', 1);
    await mod.markDeleted('week-plan', 'tue');
    await mod.setLastSeenVersion('saved-outfits', 'unrelated', 9);

    const weekPlanMetadata = await mod.getDomainMetadata('week-plan');
    expect(weekPlanMetadata).toEqual({
      mon: { lastSeenVersion: 1, isDeleted: false, isDirty: false },
      tue: { lastSeenVersion: null, isDeleted: true, isDirty: true },
    });
  });

  it('removeMetadata actually erases the entry, unlike markDeleted which preserves it as a tombstone', async () => {
    const mod = await freshModule();
    await mod.markDeleted('week-plan', 'mon');
    expect(await mod.getMetadata('week-plan', 'mon')).not.toBeNull();

    await mod.removeMetadata('week-plan', 'mon');
    expect(await mod.getMetadata('week-plan', 'mon')).toBeNull();
  });
});

describe('sync-metadata-storage — clearAllSyncMetadata', () => {
  it('wipes every domain for the CURRENT user only — Phase 1B.1: no longer wired to sign-out (see user-data-sync.ts); an explicit administrative primitive only', async () => {
    const mod = await freshModule();
    await mod.setLastSeenVersion('saved-outfits', 'a', 1);
    await mod.markDeleted('week-plan', 'b');

    await mod.clearAllSyncMetadata();

    expect(await mod.getMetadata('saved-outfits', 'a')).toBeNull();
    expect(await mod.getMetadata('week-plan', 'b')).toBeNull();
  });

  it('does not affect a different user\'s metadata', async () => {
    const mod = await freshModule();
    await mod.setLastSeenVersion('saved-outfits', 'a', 1);

    getCurrentUserIdMock.mockResolvedValue('user-2');
    await mod.setLastSeenVersion('saved-outfits', 'b', 2);
    await mod.clearAllSyncMetadata(); // clears user-2's metadata only

    getCurrentUserIdMock.mockResolvedValue('user-1');
    expect(await mod.getMetadata('saved-outfits', 'a')).toEqual({ lastSeenVersion: 1, isDeleted: false, isDirty: false });
  });
});

describe('sync-metadata-storage — Phase 1B.1: user-scoped storage', () => {
  it('the same domain+id for two different users does not collide', async () => {
    const mod = await freshModule();

    getCurrentUserIdMock.mockResolvedValue('user-1');
    await mod.setLastSeenVersion('saved-outfits', 'shared-id', 5);

    getCurrentUserIdMock.mockResolvedValue('user-2');
    await mod.markDeleted('saved-outfits', 'shared-id');

    getCurrentUserIdMock.mockResolvedValue('user-1');
    expect(await mod.getMetadata('saved-outfits', 'shared-id')).toEqual({ lastSeenVersion: 5, isDeleted: false, isDirty: false });

    getCurrentUserIdMock.mockResolvedValue('user-2');
    expect(await mod.getMetadata('saved-outfits', 'shared-id')).toEqual({ lastSeenVersion: null, isDeleted: true, isDirty: true });
  });

  it('every mutating and read function throws when there is no resolvable current user, rather than silently defaulting to a shared/anonymous key', async () => {
    const mod = await freshModule();
    getCurrentUserIdMock.mockResolvedValue(null);

    await expect(mod.getMetadata('saved-outfits', 'x')).rejects.toThrow(/no signed-in user/i);
    await expect(mod.setLastSeenVersion('saved-outfits', 'x', 1)).rejects.toThrow(/no signed-in user/i);
    await expect(mod.markDeleted('saved-outfits', 'x')).rejects.toThrow(/no signed-in user/i);
    await expect(mod.markActive('saved-outfits', 'x')).rejects.toThrow(/no signed-in user/i);
    await expect(mod.removeMetadata('saved-outfits', 'x')).rejects.toThrow(/no signed-in user/i);
    await expect(mod.clearAllSyncMetadata()).rejects.toThrow(/no signed-in user/i);
  });

  it('DETERMINISTIC reproduction of the sign-out/user-switch race Phase 1B.1 fixes: a write that resolved its owner BEFORE a user switch must land under the ORIGINAL owner\'s key, never the new user\'s — even though the underlying AsyncStorage calls for that write only complete afterward', async () => {
    const mod = await freshModule();

    // This operation resolves its owner (user-1) on this specific call...
    getCurrentUserIdMock.mockResolvedValueOnce('user-1');
    const inFlightWrite = mod.markActive('saved-outfits', 'shared-id');

    // ...and only AFTER that resolution has already happened (mockResolvedValueOnce
    // is consumed synchronously by requireCurrentUserId's first await), the
    // "current user" changes — modeling a sign-out + a different user signing
    // in while the write above is still completing its own AsyncStorage
    // read-modify-write cycle. No real timers/sleeps needed: the mock's
    // queued one-shot value already proves the write captured its owner
    // before this line ever runs.
    getCurrentUserIdMock.mockResolvedValue('user-2');
    await inFlightWrite;

    getCurrentUserIdMock.mockResolvedValueOnce('user-1');
    expect(await mod.getMetadata('saved-outfits', 'shared-id')).toEqual({ lastSeenVersion: null, isDeleted: false, isDirty: true });

    getCurrentUserIdMock.mockResolvedValueOnce('user-2');
    expect(await mod.getMetadata('saved-outfits', 'shared-id')).toBeNull();
  });
});
