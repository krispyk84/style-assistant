import AsyncStorage from '@react-native-async-storage/async-storage';

import { getCurrentUserId } from '@/lib/supabase-data';

// Phase 1B of the local<->cloud sync redesign: persistent local BOOKKEEPING
// only — not reconciliation, not an outbox, not a merge algorithm. This
// module lets a later phase answer "have I seen this record from the
// server, and at what version, and did I delete it locally?" without
// guessing from the domain object's mere presence/absence. It is
// deliberately separate from every domain's own local storage (
// saved-outfits-storage.ts, week-plan-storage.ts, closet-outfit-storage.ts)
// so sync bookkeeping never leaks into user-facing domain objects or UI.
//
// Phase 1B.1 REVISION — storage key is now PER-USER
// (`style-assistant/sync-metadata/<userId>`), not the single global
// constant Phase 1B originally used. That was a deliberate divergence from
// this app's usual "single global key + wipe on SIGNED_OUT" convention
// (see lib/user-data-sync.ts): Phase 1B's report identified a real,
// reachable race — a metadata write from User A's save/delete can still be
// in flight (this module's own functions are async, multi-await
// read-modify-write cycles) when SIGNED_OUT fires; if that write resolves
// AFTER clearAllLocalUserData's wipe but BEFORE User B signs in and reads,
// User B would read User A's leftover synchronization state. A single
// global key cannot be made safe against this by reordering alone, because
// the race is about a WRITE outliving the wipe, not about this module's own
// internal ordering.
//
// Per-user keys eliminate the race structurally rather than trying to
// detect/cancel it: every read/write resolves the CURRENT session's user id
// ONCE, at the very start of the call (before any AsyncStorage await), and
// uses that id for the entire operation. A write that was already in
// flight for User A always targets User A's own key, no matter what happens
// to the session afterward — it can never land under User B's key, because
// that key is a different string entirely. This also means sync metadata
// no longer needs (or gets) wiped on sign-out: unlike every other per-user
// UI cache in this app, this bookkeeping is SUPPOSED to survive a user
// signing out and back in on the same device — that is the entire point of
// "acknowledged server version" — so no longer clearing it on sign-out is
// a correctness improvement, not a gap. See lib/user-data-sync.ts's comment
// on why this key is intentionally absent from its wipe list.

export type SyncDomain =
  | 'saved-outfits'
  | 'week-plan'
  | 'closet-outfit-favourites'
  | 'closet-outfit-week-plan';

/**
 * `lastSeenVersion` — the latest server-side sync_version for this record
 * that this client has POSITIVELY OBSERVED and incorporated into its known
 * state. Never a local edit count, an expected-next version, a last-
 * attempted version, or a timestamp. `null` means "no acknowledged server
 * version" — a locally-created record that has never round-tripped through
 * an authoritative server read/write response. Never defaulted to `0`:
 * `0` would be indistinguishable from a real server version if this
 * project's versions ever started at 0 (Phase 1A's actually start at 1,
 * but this module doesn't assume that — `null` is the only honest
 * representation of "unknown").
 *
 * `isDeleted` — true once the user has intentionally deleted this record
 * locally. This is a TOMBSTONE: it must survive independently of whether
 * the corresponding domain object still exists in its own local storage.
 * Nothing in this phase propagates the deletion to the cloud — that is
 * later-phase (outbox) work.
 */
export type RecordSyncMetadata = {
  lastSeenVersion: number | null;
  isDeleted: boolean;
};

const STORAGE_KEY_PREFIX = 'style-assistant/sync-metadata';

// No existing storage-versioning convention exists elsewhere in this repo
// (every other lib/*-storage.ts file just defensively re-validates loosely-
// typed JSON) — but this metadata is going to become load-bearing
// synchronization state for later phases, so it gets one: an explicit
// schemaVersion tag. A future incompatible shape change bumps this number;
// old persisted JSON with a mismatched (or missing) schemaVersion is
// treated as absent rather than guessed at — see readShape below. This is
// deliberately the simplest thing that provides that guarantee, not a
// migration framework.
const SCHEMA_VERSION = 1;

type DomainMetadataMap = Record<string, RecordSyncMetadata>;

type PersistedShape = {
  schemaVersion: number;
  domains: Partial<Record<SyncDomain, DomainMetadataMap>>;
};

function emptyShape(): PersistedShape {
  return { schemaVersion: SCHEMA_VERSION, domains: {} };
}

function isRecordSyncMetadata(value: unknown): value is RecordSyncMetadata {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const versionOk = candidate.lastSeenVersion === null || typeof candidate.lastSeenVersion === 'number';
  return versionOk && typeof candidate.isDeleted === 'boolean';
}

function buildStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}/${userId}`;
}

/**
 * Resolves the CURRENT session's user id, once, and throws if there isn't
 * one. Every exported function below calls this FIRST, before any
 * AsyncStorage access — capturing the id this early (rather than, say,
 * re-checking it partway through a read-modify-write cycle) is what makes
 * a delayed/in-flight write immune to a subsequent sign-out/sign-in: the
 * key this call resolves to is fixed for the lifetime of the operation.
 * Throwing on no session (rather than silently no-op'ing, or falling back
 * to some shared/anonymous key) is deliberate: synchronization bookkeeping
 * has no safe default owner, and Part 2 of this session's hardening pass
 * requires metadata failures to be visible, not silent.
 */
async function requireCurrentUserId(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('sync-metadata-storage: no signed-in user — refusing to read or write synchronization bookkeeping without a resolvable owner.');
  }
  return userId;
}

async function readShape(userId: string): Promise<PersistedShape> {
  const raw = await AsyncStorage.getItem(buildStorageKey(userId));
  if (!raw) return emptyShape();

  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as { schemaVersion?: unknown }).schemaVersion !== SCHEMA_VERSION ||
      typeof (parsed as { domains?: unknown }).domains !== 'object' ||
      (parsed as { domains?: unknown }).domains === null
    ) {
      // Unrecognized or incompatible shape (including a schemaVersion from
      // a future build this one predates) — never guess what it means.
      return emptyShape();
    }
    return parsed as PersistedShape;
  } catch {
    return emptyShape();
  }
}

async function writeShape(userId: string, shape: PersistedShape): Promise<void> {
  await AsyncStorage.setItem(buildStorageKey(userId), JSON.stringify(shape));
}

async function readRecord(userId: string, domain: SyncDomain, id: string): Promise<RecordSyncMetadata | null> {
  const shape = await readShape(userId);
  const candidate = shape.domains[domain]?.[id];
  return candidate && isRecordSyncMetadata(candidate) ? candidate : null;
}

async function updateRecord(userId: string, domain: SyncDomain, id: string, next: RecordSyncMetadata): Promise<void> {
  const shape = await readShape(userId);
  const domainMap: DomainMetadataMap = { ...shape.domains[domain] };
  domainMap[id] = next;
  shape.domains[domain] = domainMap;
  await writeShape(userId, shape);
}

/** Returns this record's metadata, or `null` if this client has no metadata for it at all (never seen it, or it predates this phase). Scoped to the current signed-in user. */
export async function getMetadata(domain: SyncDomain, id: string): Promise<RecordSyncMetadata | null> {
  const userId = await requireCurrentUserId();
  return readRecord(userId, domain, id);
}

/** Every record this client has metadata for in one domain, for the current signed-in user — for a later reconciliation pass, not for normal UI reads. */
export async function getDomainMetadata(domain: SyncDomain): Promise<DomainMetadataMap> {
  const userId = await requireCurrentUserId();
  const shape = await readShape(userId);
  return { ...shape.domains[domain] };
}

/**
 * Records that the server's authoritative state for this record is now at
 * `version`. Call this ONLY when an existing flow has genuinely
 * incorporated that server record into local state (a fetch whose result
 * was actually written to local storage, or a write whose response was
 * actually applied) — never just because some API response happened to
 * carry a version number that was then discarded or rejected.
 */
export async function setLastSeenVersion(domain: SyncDomain, id: string, version: number): Promise<void> {
  const userId = await requireCurrentUserId();
  const current = await readRecord(userId, domain, id);
  await updateRecord(userId, domain, id, { lastSeenVersion: version, isDeleted: current?.isDeleted ?? false });
}

/**
 * Records an intentional local deletion (a tombstone). Preserves whatever
 * lastSeenVersion was already known — never invents one, never clears one.
 * This entry is NOT removed when the domain object itself is deleted; it
 * must remain queryable afterward (see removeMetadata for the distinct,
 * administrative-only operation that actually erases an entry).
 *
 * Callers (the domain *-storage.ts files) call and AWAIT this BEFORE
 * removing the domain object, and do not catch its rejection — see each
 * call site's comment for why that ordering is what makes deletion intent
 * durable under interruption.
 */
export async function markDeleted(domain: SyncDomain, id: string): Promise<void> {
  const userId = await requireCurrentUserId();
  const current = await readRecord(userId, domain, id);
  await updateRecord(userId, domain, id, { lastSeenVersion: current?.lastSeenVersion ?? null, isDeleted: true });
}

/**
 * Marks a record active — covers both a brand-new local record and an
 * intentional re-creation of a previously-tombstoned logical id (e.g.
 * reassigning a week-plan day, or re-saving a favourite whose id was
 * deleted and is now being reused).
 *
 * lastSeenVersion is deliberately PRESERVED here, never reset to null on
 * re-creation. This is provable from Phase 1A's own protocol, not a
 * guess: a tombstoned row still exists server-side (delete is always
 * soft), so the only legitimate way to reactivate it is an UPDATE whose
 * baseVersion matches the tombstone's current sync_version — never a
 * fresh CREATE (Phase 1A's create RPCs explicitly reject an already-
 * existing id, tombstoned or not, as create_conflict). The last version
 * this client observed for the tombstone IS the value a future outbox
 * would need to submit as that reactivating update's baseVersion, so
 * erasing it here would destroy information Phase 2/3 actually needs.
 * If nothing was ever observed (lastSeenVersion already null), there is
 * nothing to preserve and null remains the honest value.
 */
export async function markActive(domain: SyncDomain, id: string): Promise<void> {
  const userId = await requireCurrentUserId();
  const current = await readRecord(userId, domain, id);
  await updateRecord(userId, domain, id, { lastSeenVersion: current?.lastSeenVersion ?? null, isDeleted: false });
}

/**
 * Administrative/reset use only — actually erases a metadata entry. NOT
 * part of normal record deletion (that's markDeleted, which preserves the
 * entry as a tombstone). There is no current call site for this; it exists
 * so a later phase has a way to prune metadata deliberately, distinct from
 * a domain-level delete.
 */
export async function removeMetadata(domain: SyncDomain, id: string): Promise<void> {
  const userId = await requireCurrentUserId();
  const shape = await readShape(userId);
  const domainMap: DomainMetadataMap = { ...shape.domains[domain] };
  delete domainMap[id];
  shape.domains[domain] = domainMap;
  await writeShape(userId, shape);
}

/**
 * Wipes all sync metadata for the CURRENT signed-in user only. NOT called
 * on sign-out (unlike Phase 1B's original design) — see this file's
 * top-of-file note on why sync metadata is supposed to survive a user
 * signing out and back in. Kept as an explicit, deliberate administrative
 * primitive (e.g. a future "reset my sync state" action), not wired to any
 * current flow.
 */
export async function clearAllSyncMetadata(): Promise<void> {
  const userId = await requireCurrentUserId();
  await AsyncStorage.removeItem(buildStorageKey(userId));
}
