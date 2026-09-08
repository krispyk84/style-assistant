import AsyncStorage from '@react-native-async-storage/async-storage';

// Phase 1B of the local<->cloud sync redesign: persistent local BOOKKEEPING
// only — not reconciliation, not an outbox, not a merge algorithm. This
// module lets a later phase answer "have I seen this record from the
// server, and at what version, and did I delete it locally?" without
// guessing from the domain object's mere presence/absence. It is
// deliberately separate from every domain's own local storage (
// saved-outfits-storage.ts, week-plan-storage.ts, closet-outfit-storage.ts)
// so sync bookkeeping never leaks into user-facing domain objects or UI.
//
// Storage key is a single global constant, NOT namespaced by user id —
// this matches every other per-user local cache in this app (see
// lib/user-data-sync.ts's OTHER_PER_USER_KEYS comment). User isolation is
// achieved the same way every other domain achieves it here: an explicit
// wipe on SIGNED_OUT (clearAllSyncMetadata, wired into
// clearAllLocalUserData), not a per-user key or a user id embedded in the
// metadata itself.

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

const STORAGE_KEY = 'style-assistant/sync-metadata';

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

async function readShape(): Promise<PersistedShape> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
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

async function writeShape(shape: PersistedShape): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(shape));
}

async function updateRecord(domain: SyncDomain, id: string, next: RecordSyncMetadata): Promise<void> {
  const shape = await readShape();
  const domainMap: DomainMetadataMap = { ...shape.domains[domain] };
  domainMap[id] = next;
  shape.domains[domain] = domainMap;
  await writeShape(shape);
}

/** Returns this record's metadata, or `null` if this client has no metadata for it at all (never seen it, or it predates this phase). */
export async function getMetadata(domain: SyncDomain, id: string): Promise<RecordSyncMetadata | null> {
  const shape = await readShape();
  const candidate = shape.domains[domain]?.[id];
  return candidate && isRecordSyncMetadata(candidate) ? candidate : null;
}

/** Every record this client has metadata for in one domain — for a later reconciliation pass, not for normal UI reads. */
export async function getDomainMetadata(domain: SyncDomain): Promise<DomainMetadataMap> {
  const shape = await readShape();
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
  const current = await getMetadata(domain, id);
  await updateRecord(domain, id, { lastSeenVersion: version, isDeleted: current?.isDeleted ?? false });
}

/**
 * Records an intentional local deletion (a tombstone). Preserves whatever
 * lastSeenVersion was already known — never invents one, never clears one.
 * This entry is NOT removed when the domain object itself is deleted; it
 * must remain queryable afterward (see removeMetadata for the distinct,
 * administrative-only operation that actually erases an entry).
 */
export async function markDeleted(domain: SyncDomain, id: string): Promise<void> {
  const current = await getMetadata(domain, id);
  await updateRecord(domain, id, { lastSeenVersion: current?.lastSeenVersion ?? null, isDeleted: true });
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
  const current = await getMetadata(domain, id);
  await updateRecord(domain, id, { lastSeenVersion: current?.lastSeenVersion ?? null, isDeleted: false });
}

/**
 * Administrative/reset use only — actually erases a metadata entry. NOT
 * part of normal record deletion (that's markDeleted, which preserves the
 * entry as a tombstone). There is no current call site for this; it exists
 * so a later phase has a way to prune metadata deliberately, distinct from
 * a domain-level delete.
 */
export async function removeMetadata(domain: SyncDomain, id: string): Promise<void> {
  const shape = await readShape();
  const domainMap: DomainMetadataMap = { ...shape.domains[domain] };
  delete domainMap[id];
  shape.domains[domain] = domainMap;
  await writeShape(shape);
}

/** Wipes all sync metadata for every domain and every user. Called on sign-out (see lib/user-data-sync.ts) — never call this from a normal record-level flow. */
export async function clearAllSyncMetadata(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
