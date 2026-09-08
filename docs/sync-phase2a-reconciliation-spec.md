# Phase 2A — Reconciliation Protocol Design & Proof

**Status:** design/spec only. No production code implements this yet. Nothing in this
document has been wired into the app. See "Recommended Phase 2B implementation
sequence" (§K) for what comes next.

**Depends on:** Phase 1A (`272fd54f`, `8278a7ab` — version-aware Supabase RPCs / CAS
primitives), Phase 1B (`7c1dd4f1` — persistent local sync metadata), Phase 1B.1
(`7448db03` — metadata durability, per-user storage, `saved_outfits.id` type fix).

---

## A. Current-state findings

### A.1 The four domains, traced end-to-end

| | **saved-outfits** | **week-plan** | **closet-outfit-favourites** | **closet-outfit-week-plan** |
|---|---|---|---|---|
| Shape | **document-like** | **slot/keyed-state** | **document-like** | **slot/keyed-state** |
| Local identity | `` `${requestId}:${tier}[:g${generation}]` `` (`buildSavedOutfitId`) | `dayKey` (`YYYY-MM-DD`) | `outfit.id` (opaque, generator-assigned) | `dayKey` |
| Server identity | `saved_outfits.id` (text) | `(user_id, day_key)` composite PK | `ClosetOutfitFavourite.id` (Prisma `String @id`) | `(supabaseUserId, dayKey)` compound unique |
| Local storage key | `style-assistant/saved-outfits` (one JSON array) | `style-assistant/week-plan` | `style-assistant/closet-outfit-favourites` | `style-assistant/closet-outfit-week-plan` |
| Cloud table | `saved_outfits` (Supabase project DB) | `week_plan` (Supabase project DB) | `ClosetOutfitFavourite` (backend Prisma DB) | `ClosetOutfitWeekPlanItem` (backend Prisma DB) |
| Server `sync_version` | yes (Phase 0), default 1 | yes (Phase 0) | yes (Phase 0) | yes (Phase 0) |
| Server tombstone | `deleted_at` column exists; only the **new** RPC path (unused by any installed client) ever sets it — legacy `deleteSavedOutfitFromSupabase` still does a **physical** `DELETE` | same as saved-outfits (`deleteWeekPlanItemFromSupabase` still physical) | `deletedAt` column; legacy `deleteFavourite` repository method still does `deleteMany` (**physical**) | same as favourites (`deleteWeekPlanItem` still physical) |
| Current fetch path | `fetchSavedOutfitsFromSupabase` — `select('*')`, maps only `{id, requestId, savedAt, input, recommendation}` — **no syncVersion, no deletedAt, no tombstone filter** | `fetchWeekPlanFromSupabase` — same shape/gap | `getFavourites` (service) → `findAllFavourites` (repo) — filters `deletedAt: null` (Phase 1A §8 fix), but service mapping **drops syncVersion/deletedAt** before returning | `getWeekPlan` — same as favourites |
| Current direct-write path | `upsertSavedOutfitToSupabase` / `deleteSavedOutfitFromSupabase` — unconditional upsert, physical delete, no CAS | same shape | `upsertFavourite` / `deleteFavourite` — ownership-scoped (Phase 1B.1 fix), no CAS | `upsertWeekPlanItem` / `deleteWeekPlanItem` — no CAS |
| Phase 1A RPC availability | `create_saved_outfit` / `update_saved_outfit` / `delete_saved_outfit` — SECURITY DEFINER, CAS, `text` id (Phase 1B.1 fix). **Not applied to production yet.** | `create_week_plan_item` / `update_week_plan_item` / `delete_week_plan_item` — same. **Not applied yet.** | `createFavourite` / `updateFavouriteVersioned` / `deleteFavouriteVersioned` (repository) + `/version-aware` routes — exist, unused by any client | `createWeekPlanItem` / `updateWeekPlanItemVersioned` / `deleteWeekPlanItemVersioned` — same |
| Phase 1B metadata availability | domain key `'saved-outfits'` | `'week-plan'` | `'closet-outfit-favourites'` | `'closet-outfit-week-plan'` |
| Reachable in-place edit of an *already-active, already-synced* record? | **No** — `useResultsActions.ts:119` explicitly guards `if (savedOutfitIds.includes(savedOutfitId)) return;` before ever calling `saveSavedOutfit`; regeneration creates a **new** generation-suffixed id rather than overwriting the live one. Confirmed by reading the call site, not assumed. | **Yes** — `assignOutfitToWeekDay` unconditionally overwrites whatever is currently assigned to `dayKey`, including an already-synced live assignment. | Same pattern as saved-outfits (favouriting is a one-shot toggle keyed by a generator-assigned id); no confirmed in-place-edit call site. | Same as week-plan — `assignClosetOutfitToWeekDay` overwrites unconditionally. |

**This is the single most important structural finding**: the two **slot** domains have a
real, reachable "edit an already-synced live record" scenario; the two **document**
domains, under today's UI, do not. The decision table and the metadata-sufficiency
analysis both hinge on this and are **not** the same for all four domains — collapsing
them into one policy would be wrong.

### A.2 Local edit knowledge — what Phase 1B can and cannot prove

Phase 1B's metadata (`{ lastSeenVersion: number | null, isDeleted: boolean }`) records
**what the client last acknowledged from the server**. It does **not** record whether the
local domain object has changed *since* that acknowledgment. Concretely:

- `markActive(domain, id)` is called on every local create/reassign, and only ever
  **preserves** `lastSeenVersion` (never sets it to a new value, never clears it). It has
  no side channel for "and by the way, this write changed the content."
- `setLastSeenVersion` — the only function that *would* advance `lastSeenVersion` — has
  **zero production call sites** (confirmed by grep this session and every prior phase's
  report). No current code path ever positively observes a real server version at all.

So today, for a record with `lastSeenVersion = N`, the client cannot distinguish:

> "I saw server version N, and nothing has changed locally since."

from

> "I saw server version N, and then the user reassigned/edited it locally."

**For the document domains this ambiguity is currently unreachable** (§A.1: no in-place
edit path exists), so it does not block anything *today*. **For the two slot domains it is
real and reachable right now** (reassigning an already-synced day is a normal, expected
user action) — Phase 1B's metadata is **not sufficient** to implement correct
reconciliation for `week-plan` / `closet-outfit-week-plan` without an additional signal.
See §E for the specific gap and recommendation.

---

## B. Reconciliation invariants

These are the invariants every reconciliation decision in §C must satisfy. Where a
domain's actual data model changes what's *possible* (e.g., a slot can only hold one
value), the invariant still holds but its consequence is stated per-domain in §C/§H.

1. **No silent data loss.** A local change that has not been acknowledged by an
   authoritative server response must never be overwritten by adopting server state
   without either (a) proving the content is equivalent, or (b) an explicit conflict
   resolution.
2. **No resurrection of intentional deletion.** A local tombstone (`isDeleted: true`)
   must never flip back to active purely because an older/unrelated server record is
   observed. Reactivation only happens through an explicit local action (`markActive`,
   i.e. the user redoing something), never as a side effect of reading server state.
3. **No stale overwrite.** A client whose `lastSeenVersion` is N must never issue a
   mutation that silently succeeds against a server that has already moved past N — CAS
   (`baseVersion`) is the only mechanism that decides this, never inferred locally.
4. **No cross-user state.** Every reconciliation read/write is scoped by the
   authenticated session exactly as Phase 1A/1B.1 already established — reconciliation
   introduces no new authorization surface (see §J).
5. **Server version truth.** `lastSeenVersion` advances **only** when a specific,
   named server `sync_version` has actually been incorporated into local state (a
   fetch that was actually applied, or a mutation whose CAS response was actually
   consumed) — never speculatively, never because "some" response happened to mention a
   number.
6. **Idempotence.** Running reconciliation twice with no intervening local or server
   change produces the same outcome and issues no additional mutations the second time.
7. **Determinism.** The same `(local state, local metadata, server state)` triple always
   yields the same action — no reliance on wall-clock time, request ordering, or which
   replica answered.
8. **Deletion is state, not absence.** A tombstone is a fact that must be positively
   read and compared, never inferred from "the record wasn't in the list." This is why
   §F requires reconciliation reads to include tombstoned rows.
9. **CAS is the only concurrency primitive.** Timestamps (`savedAt`, `assignedAt`) are
   never used to decide who wins a conflict — see the dedicated analysis immediately
   below.
10. **Per-record independence.** Reconciling one record must never depend on the
    outcome of reconciling another record in the same or a different domain, and a
    process death partway through a batch must leave every already-reconciled record in
    a valid, non-reconciled-again-incorrectly state (this is what makes §I's "process
    dies midway" analysis possible at all).
11. **Conservative legacy default.** When ancestry cannot be established (no metadata,
    unclear which side is authoritative), the chosen action must be the one whose
    worst-case outcome is *cheapest to undo* — see §H.

### B.1 Why timestamps are not a conflict-resolution mechanism

`savedAt` (saved-outfits, closet-outfit-favourites) and `assignedAt` (week-plan,
closet-outfit-week-plan) are set via `new Date().toISOString()` **on the device**, at the
moment of a local write — not a server-assigned, monotonic, cross-device-comparable
value. Four concrete reasons this cannot safely drive "newest wins":

1. **Device clocks disagree.** Two phones can have clocks skewed by minutes or more
   (wrong timezone, unset auto-time, a stale clock after being offline); "later
   timestamp" does not mean "later in real time," let alone "later in causal/sync order."
2. **Offline changes have no fixed relationship to server arrival order.** A change made
   offline three days ago is stamped with a timestamp from three days ago but might only
   reach the server *after* a change made five minutes ago on another device — a
   timestamp comparison would pick the offline change as "newer" by wall-clock label
   while it is actually older in every sense that matters for conflict resolution.
3. **These fields carry business meaning, not sync ordering.** `savedAt` means "when the
   user saved this look" to the user-facing UI (e.g. "Saved 3 days ago"). Silently
   rewriting it as part of conflict resolution — or trusting it as a tiebreaker whose
   losing side gets discarded — corrupts a value the user actually reads, for a purpose
   (picking a sync winner) that has nothing to do with what the field means to them.
4. **Not every domain even guarantees the timestamp changes on every mutation** in a way
   that would make it a reliable proxy for "which write is newer" (e.g. a slot
   reassignment always sets a fresh `assignedAt`, but that only tells you *this device's*
   local write time, not how it relates to a concurrent write elsewhere).

`sync_version` (server-assigned, monotonically incremented under CAS) is the only value
in this system with the properties a conflict-order decision actually needs: it is
assigned by the single authoritative server, strictly increasing, and directly tied to
the CAS mechanism Phase 1A already implements and this spec builds on exclusively.

---

## C. Full decision table

Notation used throughout:

- **L** — local domain object: `present` / `absent`.
- **Meta** — local sync metadata: `absent` (never seen by Phase 1B) or
  `{lastSeenVersion: N|null, isDeleted}`.
- **S** — server state, from a read that **includes tombstones** (§F): `absent` (no row
  at all), `active@V`, or `tombstone@V`.
- **Dirty** — whether the local record has changed since `lastSeenVersion` was recorded.
  Marked **`UNKNOWN`** where Phase 1B cannot currently answer this (§A.2) — those rows are
  exactly the ones §E's proposed `isDirty` field would resolve.
- **Action** — one of the finite actions defined in §D.

### Case A — First observation

`L=absent, Meta=absent, S=active@N`

| Domain | Action | Metadata result |
|---|---|---|
| all | `ADOPT_SERVER` | `lastSeenVersion=N, isDeleted=false` |

No ambiguity: nothing local to protect, server is authoritative by default.

### Case B — Everything already agrees

`L=present, Meta={N,false}, S=active@N`, Dirty=false

| Domain | Action |
|---|---|
| all | `NO_OP` |

Metadata unchanged. This is the steady-state case and must be cheap (§I: idempotent by
construction, no writes at all).

### Case C — Server advanced, local unchanged

`L=present, Meta={N,false}, S=active@N+1`, Dirty=false

| Domain | Action | Metadata result |
|---|---|---|
| all | `APPLY_SERVER` | `lastSeenVersion=N+1, isDeleted=false` |

Safe only because Dirty=false is *known* — for the slot domains this requires the §E
addition; **without it, this case is not currently distinguishable from Case E** (see
below).

### Case D — Local changed, server unchanged

`L=present, Meta={N,false}, S=active@N`, Dirty=true

| Domain | Action | Metadata result on success |
|---|---|---|
| `week-plan`, `closet-outfit-week-plan` | `UPDATE_SERVER` (baseVersion=N) | `lastSeenVersion=N+1, isDeleted=false` |
| `saved-outfits`, `closet-outfit-favourites` | not reachable today (§A.1) — defined for completeness/future-proofing only | same, if it ever becomes reachable |

### Case E — Both changed (real conflict)

`L=present, Meta={N,false}, S=active@N+1`, Dirty=true

| Domain | Action |
|---|---|
| all | `CONFLICT` |

**Never** resolved by comparing `savedAt`/`assignedAt` timestamps (see the timestamp-trust
discussion below §D). Domain-specific policy for *what the conflict UX does* is in §H;
the reconciliation engine's output is uniformly `CONFLICT` — policy is layered on top, not
baked into the decision table.

Without §E's `isDirty` addition, **Case E and Case C are indistinguishable for the slot
domains** — the engine would have to either always assume Dirty (over-triggering
conflicts on every harmless server-ahead case) or never assume it (silently losing local
edits, violating invariant B.1). This is the concrete, evidence-based justification for
the metadata gap called out in §A.2/§E, not a hypothetical.

### Case F — Local intentional delete, server unchanged

`L=absent, Meta={N,true}, S=active@N`

| Domain | Action | Metadata result on success |
|---|---|---|
| all | `DELETE_SERVER` (baseVersion=N) | `lastSeenVersion=N+1, isDeleted=true` |

### Case G — Local delete, server changed afterward (real conflict)

`L=absent, Meta={N,true}, S=active@N+1`

| Domain | Policy | Action |
|---|---|---|
| `saved-outfits`, `closet-outfit-favourites` | **deletion wins** — an explicit local delete is a strong, deliberate signal; a lagging edit under the same id is either self-inflicted (see §A.1: not reachable today) or an edge case whose safest resolution is to honor the delete. | `DELETE_SERVER` (baseVersion=N+1, i.e. re-attempt the delete against the now-current version) |
| `week-plan`, `closet-outfit-week-plan` | **conflict, not auto-resolved** — another device may have legitimately reassigned the day after this device cleared it; silently deleting would destroy that device's real work, silently keeping the delete would destroy it just as one-sidedly the other way. | `CONFLICT` |

This is a genuine policy call, not a derived fact — stated explicitly per §8's
requirement, not guessed uniformly.

### Case H — Server deleted, local unchanged

`L=present, Meta={N,false}, S=tombstone@N+1`, Dirty=false

| Domain | Action | Metadata result |
|---|---|---|
| all | `DELETE_LOCAL` | `lastSeenVersion=N+1, isDeleted=true` |

Local domain object removed to match the server's tombstone; this is the mirror of Case
C and has the same Dirty-must-be-known precondition for the slot domains.

### Case I — Server deleted, local locally edited (real conflict)

`L=present with edits after N, Meta={N,false}, S=tombstone@N+1`

| Domain | Policy | Action |
|---|---|---|
| `saved-outfits`, `closet-outfit-favourites` | Not reachable today (§A.1); if it ever becomes reachable, treat symmetrically with Case O (§ below) since it's really "local wants this identity active, server currently doesn't" | `CONFLICT` (defined for completeness) |
| `week-plan`, `closet-outfit-week-plan` | Symmetric with Case G — an explicit local reassignment shouldn't be silently discarded because another device cleared the day, nor should it silently override that clear. | `CONFLICT` |

### Case J — Both independently deleted

`L=absent, Meta={N,true}, S=tombstone@M` (M may equal or exceed N)

| Domain | Action | Metadata result |
|---|---|---|
| all | `NO_OP` (content) + metadata refresh if `M ≠ N` | `lastSeenVersion=M, isDeleted=true` |

No user-visible action; metadata is kept current so a *later* observation of `M+1`
(someone reactivated it elsewhere) is correctly seen as "server advanced" against an
accurate baseline rather than a stale one.

### Case K — Legacy local record, server truly absent

`L=present, Meta=absent, S=absent` (confirmed absent, not merely unfetched — see §F: the
read must include tombstones, so "absent" here really means no row at all, live or dead)

| Domain | Action | Reasoning |
|---|---|---|
| all | `CREATE_SERVER` | Phase 1A's create RPC is safe-by-construction: it only succeeds if truly absent (`ON CONFLICT DO NOTHING` / Prisma unique-violation-caught). If the record actually *was* deleted on another device, the server row would be a **tombstone**, not absent — meaning this case's precondition (confirmed absent) would not hold, and the record would instead be routed to Case L or a not-yet-listed "legacy vs. tombstone" variant of it, never silently resurrected by this action. The RPC contract itself is the safety net, not an assumption. |

This directly resolves the "do not guess" requirement: `CREATE_SERVER` is provably safe
here specifically because the read that produced `S=absent` already ruled out the
dangerous alternative (a tombstone).

### Case L — Legacy local record, server active, no metadata

`L=present, Meta=absent, S=active@V`

| Content comparison | Action | Metadata result |
|---|---|---|
| Local content deep-equals server content (normalized comparison, ignoring key order) | `ADOPT_SERVER` (content write is a no-op since already equal; metadata is the only real effect) | `lastSeenVersion=V, isDeleted=false` |
| Content differs | `CONFLICT` | none until resolved |

"Avoid creating unnecessary user conflicts where equality gives proof" (§13) is satisfied
by the equality branch; the instruction is equally explicit that *differing* content with
no ancestry must **not** be silently resolved either direction — hence `CONFLICT`, not a
guessed default winner.

### Case M — Metadata says active, domain object absent (internal drift)

`L=absent, Meta={N,false}`

This is not a normal sync state — Phase 1B.1's tombstone-first ordering means a
`markDeleted` failure can never leave this exact shape (§Phase 1B.1 report). The realistic
trigger is a **bulk replace** (`replaceSavedOutfits`/`replaceWeekPlan`, used by the
existing crude cloud-fallback/sign-in sync in `lib/user-data-sync.ts`) overwriting the
entire local array from a source that doesn't independently know about this specific id,
silently dropping it without ever calling `markDeleted`.

| Action | Behavior |
|---|---|
| `REPAIR_METADATA` | Do **not** assume this means deleted (that would be presumptuous) and do **not** assume it means still-active (the object is verifiably gone). Re-derive purely from the server read: `S=active@V` → `ADOPT_SERVER` (re-materialize locally); `S=tombstone@V` → mark deleted, no local re-materialization; `S=absent` → the metadata entry no longer protects any distinction worth keeping — remove it (`removeMetadata`), collapsing this record back to "never seen" for future runs. |

### Case N — Tombstone exists, server absent entirely

`L=absent, Meta={N,true}, S=absent` (confirmed absent via a tombstone-inclusive read)

| Action | Reasoning |
|---|---|
| `NO_OP` | Nothing to reconcile — this is either a record that was created and deleted entirely locally before ever syncing, or a delete whose server tombstone has since been GC'd (server-side retention policy, out of scope here). |

**Garbage collection criterion (documented, not implemented):** this tombstone becomes
safe to remove locally once **full agreement is reached and confirmed**: `isDeleted=true`
and `lastSeenVersion` equals the server's actual current version for this identity (or the
identity is confirmed server-absent, as here). At that point no future distinction is
lost by forgetting it — if the identity is later reactivated on another device, this
device will observe it fresh as Case L/A (metadata absent, server active), which is
already correctly handled as "adopt server, no conflict," not "assume deleted." GC is
explicitly **not implemented in this phase**.

### Case O — Re-created previously-deleted record (deliberate reactivation)

`L=present, Meta={N,false} (reactivated via markActive), S=tombstone@N`

| Domain | Action | Metadata result on success |
|---|---|---|
| all | `REACTIVATE_SERVER` (update RPC, baseVersion=N — matches the tombstone's own version, which Phase 1B.1's `markActive` provably preserves rather than erasing) | `lastSeenVersion=<returned version>, isDeleted=false` |

This is the case Phase 1A's protocol was explicitly built for and Phase 1B.1 explicitly
proved end-to-end (tombstone-reuse tests, both in the disposable-Postgres verification
and the backend Prisma test suite). **`REACTIVATE_SERVER` and `UPDATE_SERVER` are the same
underlying RPC call** (`update_*` doesn't care whether the row it's updating happens to be
currently tombstoned) — kept as a distinct named action for observability/testability
(§D), not because the protocol distinguishes them.

---

## D. Finite action model

```
NO_OP                    — nothing to do; no reads, no writes, no metadata change.
ADOPT_SERVER             — write server content into local domain storage (or confirm
                            it already matches); set lastSeenVersion=server V,
                            isDeleted=false.
CREATE_SERVER            — call create RPC with local content, no baseVersion; on
                            'created' set lastSeenVersion=returned V; on
                            'create_conflict' re-fetch and re-route (never silently
                            treated as success).
UPDATE_SERVER            — call update RPC with baseVersion=lastSeenVersion; on
                            'applied' set lastSeenVersion=returned V; on 'conflict',
                            see idempotence proof (§I) before treating as a real conflict.
DELETE_SERVER            — call delete RPC with baseVersion=lastSeenVersion; on
                            'applied' set lastSeenVersion=returned V, isDeleted stays
                            true; on 'conflict', see §I.
REACTIVATE_SERVER        — call update RPC with baseVersion=lastSeenVersion (which
                            equals the tombstone's version); same success/metadata
                            handling as UPDATE_SERVER. Distinct name only.
DELETE_LOCAL             — remove the local domain object; set isDeleted=true,
                            lastSeenVersion=server's tombstone version.
CONFLICT                 — no local or server mutation; hand off to the domain-specific
                            policy (§H) for UI/resolution. Re-detecting the same
                            conflict on a later run is safe (idempotent no-op until
                            resolved).
REPAIR_METADATA          — re-derive local metadata from a fresh authoritative server
                            read when local state is internally inconsistent (Case M);
                            never a normal per-cycle outcome.
DEFER_UNKNOWN_LEGACY_STATE — reserved for a state this spec could not resolve safely;
                            not actually needed by any case in §C (every legacy case
                            resolved to a concrete action) — kept in the enum as an
                            explicit escape hatch Phase 2B must raise/log loudly rather
                            than silently falling through if a future case doesn't
                            match anything in §C.
```

Phase 2B's engine should be a pure function
`(local, metadata, server) -> { action, metadataPatch }`, matching every row above,
with domain-specific policy (§H) supplied as a small per-domain table/strategy object,
not scattered conditionals inside the storage files.

---

## E. Metadata gap analysis

**Finding: `{lastSeenVersion, isDeleted}` is sufficient for the document domains under
today's UI, and not sufficient for the slot domains, full stop — not a hypothetical.**
Case C vs. Case E collapse into the same observable state
(`L=present, Meta={N,false}, S=active@N+1`) without a dirty signal, and a slot's
in-place-reassignment is a normal, reachable action today.

### Candidates considered

| Candidate | Resolves | Persistence | Transition | Restart-safe | Verdict |
|---|---|---|---|---|---|
| `isDirty: boolean` | Exactly the C-vs-E ambiguity: was there a local write since the last acknowledgment. | One extra boolean per record, same envelope. | `true` on every local create/reassign (same hook points that already call `markActive`); `false` only after a reconciliation cycle successfully incorporates the resulting server version. | Yes (same JSON blob). | **Recommended.** Smallest state machine that resolves the actual, evidenced ambiguity. |
| `pendingOperation: 'none'|'create'|'update'|'delete'` | Same ambiguity, plus which RPC to call. | Same. | Same trigger points, more branches. | Yes. | Not needed — Phase 1A's protocol already disambiguates create vs. update from `lastSeenVersion` alone (`null` → create path; set → update path with that baseVersion). Adds surface area for no resolved ambiguity beyond what `isDirty` gives. |
| local mutation generation (counter) | Same ambiguity, plus "how many edits" (unneeded — no case in §C asks "how many"). | Same. | Increment on every write. | Yes. | Strictly more information than `isDirty` for no case that needs it — rejected on "smallest state machine" grounds. |
| acknowledged content hash | Same ambiguity, **and** doubles as the equality test Case L already needs, without depending on every write path remembering to set a flag. | Same envelope, one string field. | Recompute and store on every acknowledgment (successful `ADOPT_SERVER`/`UPDATE_SERVER`/etc.); compare against a fresh hash of current content to detect drift. | Yes. | Compelling dual-purpose property, but requires a stable, canonical serialization (key ordering, numeric formatting) that doesn't exist today and would itself need design/testing — heavier than the evidenced need. Worth reconsidering if Case L conflicts turn out to be common in practice; not chosen now. |

**Recommendation:** add `isDirty: boolean` to `RecordSyncMetadata` in Phase 2B, defaulting
to `true` on every `markActive`/create/reassign call site (a local write always means "I
have something not yet acknowledged"), and cleared to `false` only by the reconciliation
engine itself after a successful `ADOPT_SERVER`/`UPDATE_SERVER`/`REACTIVATE_SERVER`/
`DELETE_SERVER` whose result was actually incorporated. **Not implemented in this phase**,
per the Phase 2A scope boundary — this section identifies it, Phase 2B builds it.

---

## F. Server-read contract requirements

Every domain needs, at minimum, per record: **id, payload fields, `sync_version`,
tombstone status (`deleted_at`/`deletedAt`)**. None of the four domains' current fetch
paths return all of this today (§A.1).

| Domain | What's missing today | Required change (not made in this phase) |
|---|---|---|
| `saved-outfits` | `sync_version`, `deleted_at` not selected/mapped; no tombstone-inclusive read exists at all | `fetchSavedOutfitsFromSupabase` already does `select('*')` — the columns are already retrievable at the SQL level (Phase 1A §8's own escape clause). Needs a **second**, reconciliation-only fetch function that (a) does not filter `deleted_at`, and (b) maps `sync_version`/`deleted_at` into the returned shape. The **existing** ordinary fetch must gain an explicit `deleted_at IS NULL` filter it currently lacks — today, if a tombstone ever existed, the ordinary read would incorrectly show it as live (nothing filters it out at either the RLS or application layer). This is a real, currently-latent gap, not a hypothetical, because RLS's `auth.uid()=user_id` policy makes no distinction based on `deleted_at`. |
| `week-plan` | Same shape of gap as saved-outfits | Same two-fetch-function split; same currently-latent ordinary-read gap. |
| `closet-outfit-favourites` | Ordinary read (`findAllFavourites`) already filters `deletedAt: null` (Phase 1A §8) — safe. But `getFavourites` (service) drops `syncVersion`/`deletedAt` before returning, and the tombstone-inclusive repository method (`findAllFavouritesIncludingDeleted`) exists but has **no service method or route** exposing it. | Add a service method + route surfacing `findAllFavouritesIncludingDeleted` with `syncVersion`/`deletedAt` mapped in (mirroring `toFavouriteItem`, which already includes them). |
| `closet-outfit-week-plan` | Same as favourites | Same: expose `findAllWeekPlanItemsIncludingDeleted` via a service method + route. |

**RLS/security check (tie-in to §J):** for the direct-Supabase domains, RLS's
`auth.uid() = user_id` policy applies uniformly to `SELECT` regardless of `deleted_at` —
a tombstone-inclusive read is **already safely ownership-scoped** by the existing policy;
no RLS change is needed, only an application-level query change (removing/adding the
`deleted_at` filter depending on which fetch function is being written). For the
backend-mediated domains, the equivalent tombstone-inclusive repository methods already
exist and are already scoped by `supabaseUserId` (Phase 1A). No security design change is
required here — only exposing what's already safely queryable.

---

## G. Domain-specific conflict policies

| Domain | Natural shape | Recommended policy for `CONFLICT` |
|---|---|---|
| **Saved outfit** | Document; today, conflicts are structurally near-impossible (id is derived from a device+time-specific `requestId`, and the UI never edits an already-active id — §A.1). If a genuine conflict is ever produced (e.g. a future regenerate-in-place feature), recommend **duplicate-as-copy**: preserve both under distinct ids rather than forcing a choice or silently picking one — cheapest-to-undo per invariant B.11, since a duplicate is just an extra list item the user can delete. |
| **Week-plan day** | Slot; a day holds exactly one value, so a conflict is a real "which assignment do I keep" question with no cheap non-destructive middle ground. Recommend **explicit user choice** (surface both candidates, let the user pick) — never an automatic timestamp-based pick (§ timestamp discussion). A pragmatic non-blocking default (e.g. defaulting the picker's initial selection to the server's version while still requiring confirmation) is a legitimate product choice layered on top, not a silent auto-resolution. |
| **Closet-outfit favourite** | Document; same reasoning and recommendation as saved outfit. | 
| **Closet-outfit week-plan day** | Slot; same reasoning and recommendation as week-plan day. |

---

## H. Legacy-upgrade behavior

Existing installs will have local objects, cloud objects, and (for everyone, since Phase
1B ships after all of them) **no sync metadata for any pre-existing record** — every
record starts in Case K or Case L on the very first reconciliation run.

- **Case K** (server truly absent): `CREATE_SERVER`. Safe because the create RPC itself
  cannot silently clobber a tombstone (§C, Case K) — the worst case is a redundant push of
  a record that already exists elsewhere as a tombstone, which surfaces as
  `create_conflict` and re-routes rather than corrupting anything.
- **Case L** (server active): content-equality check first. Equal → silently adopt
  (`ADOPT_SERVER`, no user-visible event). Different → `CONFLICT`, never a guessed
  winner — this is the direct application of "avoid unnecessary conflicts where equality
  gives proof, but don't invent proof where none exists."

No blanket "local wins" or "server wins" rule is applied at the legacy-upgrade boundary;
every record is routed through the same per-record decision table as steady-state
reconciliation, just starting from `Meta=absent` instead of a populated entry.

---

## I. Failure / retry / idempotence analysis

| Action | Failure point | Recoverable? | Why |
|---|---|---|---|
| `CREATE_SERVER` | Process dies after RPC success, before local metadata write | Yes | Next run retries `CREATE_SERVER` (metadata still shows never-synced); gets `create_conflict`; re-fetches the now-existing row and adopts its version. One wasted round trip, no corruption. |
| `UPDATE_SERVER` / `REACTIVATE_SERVER` | Process dies after CAS success, before storing the returned version | Yes, with one extra step: the retried call reuses the **stale** `baseVersion` (since metadata was never updated) and gets `conflict`, not `applied`. **The engine must check whether the returned "conflicting" row's content matches what this device was trying to write** — if so, this is not a foreign conflict, it's this device's own earlier success it never heard back from; adopt the returned version as success. This is exactly the ambiguity Phase 1A §5 explicitly designed the result contract to make resolvable later ("expose enough authoritative info to determine genuine stale conflict vs. a previous identical mutation that probably succeeded") — Phase 2B is where that design pays off. | Content-match check on conflict responses is required for this to be safe — flagged as a Phase 2B implementation requirement, not optional. |
| `DELETE_SERVER` | Same shape as update: retried delete with a stale `baseVersion` gets `conflict`; if the returned row is already tombstoned at a version this device doesn't recognize as foreign, adopt it as its own earlier success. | Yes, same mechanism as above. |
| `ADOPT_SERVER` / `DELETE_LOCAL` | Process dies between the domain-storage write and the metadata write | Yes | Purely local; a retried reconciliation pass re-derives the identical action from the identical inputs and re-applies it — idempotent by construction (no network round trip involved). |
| `CONFLICT` | N/A — no mutation occurs until resolved | Yes | Re-detecting is a no-op; nothing to lose. |
| `REPAIR_METADATA` | N/A — re-derives from a fresh read each time | Yes | Deterministic given the same server state. |

**Process termination mid-batch:** invariant B.10 (per-record independence) means a batch
reconciliation run that's interrupted after processing records 1..k of n leaves records
1..k in a valid post-reconciliation state and records k+1..n exactly as they were —
resuming the batch (in any order) is equivalent to running it fresh. Phase 2B's engine
must not introduce any cross-record transaction or ordering dependency that would violate
this.

---

## J. Security assessment

- Every reconciliation read/write is a call into the **existing** Phase 1A/1B.1
  boundaries (RLS-scoped Supabase queries and RPCs; `requireAuth`-gated backend routes
  deriving `supabaseUserId` from the verified JWT) — reconciliation adds no new
  authorization surface, only new *call sites* into surfaces already hardened and tested.
- **Cross-user ids cannot be fetched/mutated via reconciliation APIs**: confirmed by
  Phase 1A's own disposable-Postgres security tests (cross-user CAS attempts return
  `not_found`, never another user's content) and Phase 1A-corrections' explicit
  SECURITY DEFINER ownership-scoped read-backs — reconciliation calls the same functions,
  inherits the same guarantee.
- **CAS `baseVersion` cannot bypass ownership**: every RPC's `WHERE` clause includes
  `user_id = auth.uid()` (or `supabaseUserId` from the JWT) *in addition to* the version
  match — a correct `baseVersion` guessed for another user's row still fails the ownership
  predicate. Unchanged by this design.
- **Tombstoned rows remain ownership-scoped**: the new tombstone-inclusive reads
  required by §F apply the identical ownership filter as the ordinary reads (RLS
  unconditionally, or an explicit `supabaseUserId` `WHERE` clause for the backend-mediated
  domains) — a tombstone belonging to another user is exactly as unreachable as their live
  rows.
- **Conflict responses cannot leak another user's content**: already proven in Phase 1A's
  disposable-Postgres verification (a cross-user conflict/create-collision attempt returns
  either `not_found` or zero rows, never the other user's row content).
- No genuine blocking flaw was found that would require touching Phase 1A code; this
  section is a confirmation, not a corrective action.

---

## K. Recommended Phase 2B implementation sequence

Building on the smallest-safe-increment pattern this whole project has followed:

1. **`isDirty` metadata field** (§E) — add to `RecordSyncMetadata`, wire into the same
   `markActive`/create/reassign call points already touched in Phase 1B/1B.1, with the
   same failure-mode test rigor (dirty must never be silently lost or silently cleared
   without an actual acknowledged sync). No reconciliation logic yet — this is purely the
   metadata-layer prerequisite §E identified.
2. **Server-read contract fixes** (§F) — split each domain's fetch into an ordinary
   (tombstone-filtered) function and a reconciliation-only (tombstone-inclusive,
   version-carrying) function; fix the currently-latent missing `deleted_at` filter on the
   two direct-Supabase ordinary reads; add the missing service method + route for the two
   backend-mediated tombstone-inclusive reads. Pure plumbing, independently testable and
   deployable before any reconciliation logic exists.
3. **Pure decision-table engine** — implement §C/§D as a pure function per domain
   (`(local, metadata, server) -> {action, metadataPatch}`), unit-tested exhaustively
   against every case in §C plus the idempotence scenarios in §I, with **no** side effects
   (no AsyncStorage, no network) — a decision function you can property-test.
4. **Domain-specific conflict policy layer** (§H) — a small per-domain strategy object
   consumed by the engine's `CONFLICT` output; document-domain "duplicate-as-copy" and
   slot-domain "explicit user choice" implemented and tested independently of the engine
   itself.
5. **Execution/apply layer** — the first piece that actually calls the Phase 1A RPCs and
   writes local domain storage/metadata, driven entirely by the pure engine's output;
   this is where the content-match-on-conflict idempotence handling (§I) gets implemented
   and tested against real CAS conflict responses (disposable Postgres, matching this
   project's established verification convention).
6. Only after 1–5 are independently shipped and verified does Phase 3 (outbox scheduling,
   retries, triggering reconciliation on `SIGNED_IN`/`HYDRATED`/foreground) become
   meaningful to build — it schedules calls into the engine from step 3, it does not
   contain reconciliation logic itself.

Each step above should land as its own reviewable, testable, independently-revertable
commit — consistent with every phase so far in this project.
