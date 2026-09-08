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

### A.3 Migration-era mode: compatibility era vs. fully version-aware era

**This subsection corrects a real error in the first draft of this spec** (its original
Case K assumed server absence could only mean "genuinely never existed," which is only
true once every write path is guaranteed to soft-delete). Every case in §C is now written
against the era actually in effect today.

**Compatibility era (today, and for the foreseeable future until Phase 3C ships):**

- The legacy direct-write paths (`deleteSavedOutfitFromSupabase`, `deleteWeekPlanItemFromSupabase`,
  the backend `deleteFavourite`/`deleteWeekPlanItem` repository methods) are still live and
  still physically `DELETE` rows (§A.1). **The currently-installed app itself is a legacy
  client under this definition** — nothing has cut over to the Phase 1A RPCs yet.
- Consequently, **`server absent` never proves `record never existed`.** It may mean:
  genuinely never existed; a legacy client physically deleted it; a legacy client deleted
  it after this device last observed a version; the identity was hard-deleted and then
  recreated (fresh row, fresh version — see below); or some other migration-era state this
  spec has not anticipated.
- Consequently, **`sync_version` is monotonically increasing only within one surviving
  row's lifecycle, not across a hard-delete/recreate cycle.** A sequence like
  `active@N → legacy physical DELETE → same logical identity created again → new row at
  its own initial version` means the *new* row's version has no ordering relationship to
  `N` — it can be, and typically will be, **lower** than a `lastSeenVersion` this device
  recorded against the old, now-destroyed row. Observing `serverVersion < lastSeenVersion`
  during this era is a **distinct signal** ("this identity's lineage was reset"), never
  automatically "stale data" or "corruption" — see Case V.
- Every rule in this era defaults to the **conservative** branch whenever ancestry cannot
  be proven (invariant B.11): `DEFER_UNKNOWN_LEGACY_STATE` or `CONFLICT`, never an
  automatic `CREATE_SERVER`/`DELETE_LOCAL` from absence alone.

**Fully version-aware era (only after Phase 3C revokes direct INSERT/UPDATE/DELETE on the
protected tables, forcing every mutation through the CAS RPCs):**

- Once direct physical deletes are impossible, every deletion is a soft tombstone by
  construction — `server absent` really does mean "genuinely never existed," because there
  is no remaining code path that can make a row vanish without leaving one.
- `sync_version` becomes monotonic for the full lifetime of a logical identity, including
  across delete/reactivate cycles (Phase 1A's soft-delete-and-reactivate protocol already
  guarantees this) — the lineage-reset case (Case V) becomes unreachable and can be
  removed.
- At that point, Case K collapses back to a single `CREATE_SERVER` rule (this spec's
  original, since-corrected assumption becomes valid), and Case Q/R/T's extra conservatism
  becomes unnecessary complexity that a later phase should explicitly simplify away —
  **do not perform that simplification now**; it is only safe after Phase 3C has actually
  shipped and been verified, not merely planned.

Every case in §C below is written for the **compatibility era**, since that is the era
this app is actually in. Each case that would simplify in the fully version-aware era says
so explicitly.

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
12. **Server absence is not proof of non-existence during the compatibility era (§A.3).**
    A read that returns no row for an identity must never, by itself, justify an
    unconditional `CREATE_SERVER` when local metadata is absent (true unknown ancestry) —
    a legacy client may have physically deleted that identity with no trace. Absence only
    licenses a safe action when combined with either (a) proof this device itself just
    created the record (known local creation, §C Case K2), or (b) a positively-observed
    tombstone (not mere absence) elsewhere in the identity's history.
13. **A lower server version is a distinct signal, not corruption.** While legacy hard
    delete/recreate remains possible (§A.3), observing `serverVersion < lastSeenVersion`
    for an identity must never be treated as stale data to discard or as evidence of a
    bug — it specifically means the identity's server-side lineage was destroyed and
    recreated since this device last observed it, and must be routed through Case V, not
    through the ordinary stale/current version comparison used elsewhere in §C.

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
  at all), `active@V`, or `tombstone@V`. Per §A.3, `V` is only meaningfully ordered
  against `lastSeenVersion` **within the same row lineage** — see Case V for what happens
  when it isn't.
- **Dirty** — whether the local record has changed since `lastSeenVersion` was recorded.
  Marked **`UNKNOWN`** where Phase 1B cannot currently answer this (§A.2) — those rows are
  exactly the ones §E's proposed `isDirty` field would resolve.
- **Action** — one of the finite actions defined in §D.
- Case letters **S** and **U** are intentionally unused below — `S` collides with the
  server-state notation used throughout this table, and `U` is left as a gap rather than
  forcing a renumber if a future revision needs to insert a case between T and V.
- **Engine evaluation order**: before any of Cases A–V below are consulted, the engine
  must first check for a lineage reset (`S` exists with a version and `lastSeenVersion`
  is not null and `serverVersion < lastSeenVersion`) and route to Case V instead. Every
  other case below implicitly assumes `serverVersion >= lastSeenVersion` (or
  `lastSeenVersion = null`) — this is only true because Case V is checked first.

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

| Domain | Action |
|---|---|
| all | `CONFLICT` |

**Corrected from this spec's first draft**, which let a stale local deletion automatically
issue `DELETE_SERVER` against the newer version for the document domains ("deletion wins")
on the reasoning that a delete is a strong, deliberate signal. That reasoning does not
license the engine to discard the newer server mutation unilaterally: **the server's
version N+1 also represents someone's user intent**, and silently converting an
observed-newer version into a fresh delete `baseVersion` risks destroying that intent
exactly as one-sidedly as silently keeping the delete would destroy the deletion's intent.
The reconciliation engine's decision is uniformly `CONFLICT` for every domain; a
domain-specific policy layered on top (see "Domain-specific conflict policies" below) may
later choose "deletion wins," "duplicate-as-copy," or explicit user choice — but that
choice is not made here, and is not automatic.

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

### Case K — Local record with server truly absent — split by ancestry

**Corrected from this spec's first draft**, which routed both sub-cases below to a single
`CREATE_SERVER`, reasoning that the create RPC's `ON CONFLICT DO NOTHING` safety net
protects against silent resurrection. That reasoning only holds when the *only* possible
prior deletion mechanism is a soft tombstone. During the compatibility era (§A.3), a
legacy client can physically `DELETE` a row, leaving **no trace whatsoever** — no
tombstone for the create RPC to collide with, no evidence for reconciliation to detect.
`ON CONFLICT DO NOTHING` cannot protect against a row that no longer exists in any form.
So "confirmed absent" during this era genuinely cannot distinguish "never existed" from
"a legacy client deleted this and left nothing behind" — the two sub-cases below must be
told apart by **ancestry**, not by the read result, which is identical for both.

#### Case K1 — Legacy record, unknown ancestry

`L=present, Meta=absent, S=absent`

The domain object exists locally, but Phase 1B/2B metadata for it is **completely
absent** — meaning this record predates any Phase-1B-or-later-aware write to this exact
identity on this device (every write since Phase 1B has stamped metadata via `markActive`/
`markDeleted`, so a genuinely metadata-free record can only be one that arrived before that
code ever ran here — e.g. from local storage that predates this app version, or from the
crude bulk `replaceSavedOutfits`/`replaceWeekPlan` cloud-fallback path, §Case M).

| Domain | Action | Reasoning |
|---|---|---|
| all | `DEFER_UNKNOWN_LEGACY_STATE` | Ancestry cannot be established: this could be a record that never left the device, or one a legacy client (possibly this very device, on an older build) already deleted server-side with no trace. Invariant B.11/B.12 requires the conservative branch — never an automatic `CREATE_SERVER` from absence alone when ancestry is unknown. `DEFER_UNKNOWN_LEGACY_STATE` (rather than `CONFLICT`) is the more precise name here since there usually isn't two competing pieces of *content* to reconcile between, only an unprovable historical question — Phase 2B's execution layer should log/surface this distinctly from a genuine content conflict, but must not silently resolve it either direction. |

#### Case K2 — Record this device knows it just created

`L=present, Meta={lastSeenVersion: null, isDeleted: false, isDirty: true} (§E)`, `S=absent`

This is the case this spec's first draft was actually trying to describe, correctly
narrowed: the metadata entry **exists** (stamped by `markActive` at creation time, per
Phase 1B's already-shipped behavior), `lastSeenVersion` is `null` (never synced), and
`isDirty` is `true` (this device's own pending local write, not inherited from anywhere).

| Domain | Action | Reasoning |
|---|---|---|
| all | `CREATE_SERVER` | This device has direct, positive knowledge that it created this record itself and has never pushed it — there is no ancestry question to beg. The create RPC's `ON CONFLICT DO NOTHING` remains a correctness backstop against a coincidental id collision (§A.1's saved-outfits global-id-space discussion), not the sole justification for safety, which now rests on provable local knowledge rather than mere absence. |

**The distinguishing signal between K1 and K2 is metadata presence itself, not any new
field beyond what §E already proposes**: once `isDirty` ships, every local write stamps
metadata immediately, so "metadata completely absent" becomes a reliable proxy for "this
record predates metadata-aware code," which is exactly the boundary that matters here.

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

### Case P — Never observed locally, server tombstoned

`L=absent, Meta=absent, S=tombstone@V`

| Domain | Action | Reasoning |
|---|---|---|
| all | `NO_OP` | Nothing local to protect and nothing to push — this device has no history with this identity at all. No metadata is created proactively; if this device later attempts to create the same identity, that attempt will itself see the tombstone (tombstone-inclusive read, §F) and correctly route to a fresh Case K2/O-style evaluation rather than blindly succeeding. |

### Case Q — Legacy local record, server positively tombstoned

`L=present, Meta=absent, S=tombstone@V`

Distinguished from Case K1 by **positive evidence**: the server doesn't merely lack a row
(ambiguous under §A.3), it has an actual tombstone — proof that *some* client, using the
new soft-delete protocol, intentionally deleted this identity.

| Domain | Action | Metadata result | Reasoning |
|---|---|---|---|
| all | `DELETE_LOCAL` | `lastSeenVersion=V, isDeleted=true` | Unlike Case K1, ancestry is not actually in question here — a real tombstone is unambiguous proof of intentional deletion, regardless of whether *this* device ever knew about the record's server history. Removing the stale local copy respects that proof; it does not resurrect anything, since there is nothing local being pushed, only a local artifact being reconciled to match a documented fact. |

### Case R — Previously-synced record, server now absent (no local edit)

`L=present, Meta={N,false}, S=absent`, Dirty=false

| Domain | Action | Reasoning |
|---|---|---|
| all | `CONFLICT` (or `DEFER_UNKNOWN_LEGACY_STATE` if the execution layer wants to distinguish "no competing content" from a true content conflict — see Case K1's naming note) | This device previously synced this record at version N; it has since vanished with **no trace** (no tombstone). Per §A.3 this can only happen via a legacy hard delete. Two invariants pull in opposite directions here and neither may be resolved silently: automatically removing the local copy (`DELETE_LOCAL`) risks discarding content the user still wants if the disappearance was actually a transient/erroneous read rather than a genuine legacy delete (no such distinction is provable from a single read); automatically re-pushing or leaving it untouched for an outbox to push later risks resurrecting a legitimate legacy deletion. Neither silent branch is defensible — flagged for explicit resolution. |

### Case T — Previously-synced record, server now absent, local has a pending edit

`L=present with edits after N, Meta={N,false}, S=absent`, Dirty=true

| Domain | Action | Reasoning |
|---|---|---|
| all | `CONFLICT` | Compounds Case R with a genuine pending local change: "no silent data loss" (protect the edit) and "no resurrection of intentional deletion" (don't push if a legacy client legitimately deleted this) are both in play and point opposite directions. No automatic action is defensible. |

### Case V — Version lineage reset (hard-delete/recreate detected)

`lastSeenVersion = N (not null)`, and the current server read returns a version `M < N`
for the same identity (`S=active@M` or `S=tombstone@M`) — checked **before** every other
case per §C's evaluation-order note, since it invalidates the ordinary
stale-vs-current comparison every other case assumes.

This proves (§A.3) the identity was destroyed and recreated by *some* client since this
device last observed it — the row at version M has no causal relationship to whatever
this device remembers from version N. Sub-cases by local state:

| Local state | Action | Reasoning |
|---|---|---|
| Not dirty, not tombstoned (content unchanged since N) | Treat as a fresh first observation of a new incarnation — content-equality check against the new server content (mirrors Case L): equal → `ADOPT_SERVER`; differs → `CONFLICT`. | The local content's claim to authority was tied to the now-destroyed lineage; it has no special standing against the new incarnation beyond the same equality-based fairness Case L already gives every legacy record. |
| Dirty (local edit/reassignment pending since N) | `CONFLICT` | The pending edit's assumed baseline (version N) no longer exists in any meaningful sense — applying it against the new incarnation via CAS would be operating on a false premise, and discarding it silently would lose real user intent. Requires explicit resolution, never an automatic pick. |
| Tombstoned (`isDeleted: true` locally) | `CONFLICT` | This device's deletion intent targeted the *old*, now-gone lineage. The new incarnation is a different thing that happens to share an identity by reuse/coincidence, and automatically deciding whether the old delete "still applies" to it is exactly the kind of silent, unprovable call this spec's invariants forbid — surfaced explicitly rather than resolved either direction. |

Metadata is **not** updated to `lastSeenVersion=M` automatically in any of the three rows
above — advancing metadata for a lineage the engine hasn't actually reconciled yet would
violate invariant B.5 (version truth only advances for an *incorporated* version). It only
advances once the chosen resolution (adoption or conflict resolution) actually completes.

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
DEFER_UNKNOWN_LEGACY_STATE — used specifically when ancestry cannot be established at all
                            during the compatibility era (Case K1: a legacy record with no
                            metadata and no server row, where "never existed" and "a
                            legacy client deleted it" are indistinguishable from the read
                            alone). No mutation, local or remote. Distinct from CONFLICT:
                            CONFLICT means "two things exist and disagree, a human/policy
                            must pick"; DEFER_UNKNOWN_LEGACY_STATE means "there may not be
                            a second thing at all, and inventing one (by pushing) or
                            discarding the local copy would both be guesses." Also the
                            catch-all escape hatch Phase 2B must raise/log loudly if a
                            future combination doesn't match anything in §C, rather than
                            silently falling through.
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
record starts in Case K1, Case L, Case P, or Case Q on the very first reconciliation run
(never Case K2, which requires metadata that by definition doesn't exist yet for a
pre-existing record).

- **Case K1** (server truly absent, no metadata): **corrected from this spec's first
  draft** — `DEFER_UNKNOWN_LEGACY_STATE`, not `CREATE_SERVER`. During the compatibility
  era, a legacy client may have physically deleted this exact record with no trace at
  all; absence alone cannot license pushing it back into existence. This is the single
  most important legacy-upgrade correction in this revision.
- **Case Q** (server positively tombstoned, no metadata): `DELETE_LOCAL` — a real
  tombstone is unambiguous proof of intentional deletion regardless of this device's own
  history with the record.
- **Case L** (server active): content-equality check first. Equal → silently adopt
  (`ADOPT_SERVER`, no user-visible event). Different → `CONFLICT`, never a guessed
  winner — this is the direct application of "avoid unnecessary conflicts where equality
  gives proof, but don't invent proof where none exists."
- **Case P** (never observed, server tombstoned): `NO_OP` — nothing to reconcile.

No blanket "local wins" or "server wins" rule is applied at the legacy-upgrade boundary;
every record is routed through the same per-record decision table as steady-state
reconciliation, just starting from `Meta=absent` instead of a populated entry. Notably,
**this means a real, historically-common upgrade case — a genuinely-orphaned local
record whose server counterpart a legacy client deleted — now correctly does nothing
rather than silently resurrecting it**, at the cost of that record sitting in
`DEFER_UNKNOWN_LEGACY_STATE` until a human-facing surface (Phase 2B+ scope, not this spec)
gives the user a way to explicitly decide "keep this locally-only" vs. "actually delete
it now that I can see the ambiguity."

---

## I. Failure / retry / idempotence analysis

| Action | Failure point | Recoverable? | Why |
|---|---|---|---|
| `CREATE_SERVER` | Process dies after RPC success, before local metadata write | Yes | Next run retries `CREATE_SERVER` (metadata still shows never-synced); gets `create_conflict`; re-fetches the now-existing row and adopts its version. One wasted round trip, no corruption. |
| `UPDATE_SERVER` / `REACTIVATE_SERVER` | Process dies after CAS success, before storing the returned version | Yes, with one extra step: the retried call reuses the **stale** `baseVersion` (since metadata was never updated) and gets `conflict`, not `applied`. **The engine must check whether the returned "conflicting" row's content matches what this device was trying to write** — if so, this is not a foreign conflict, it's this device's own earlier success it never heard back from; adopt the returned version as success. This is exactly the ambiguity Phase 1A §5 explicitly designed the result contract to make resolvable later ("expose enough authoritative info to determine genuine stale conflict vs. a previous identical mutation that probably succeeded") — Phase 2B is where that design pays off. | Content-match check on conflict responses is required for this to be safe — flagged as a Phase 2B implementation requirement, not optional. |
| `DELETE_SERVER` | Same shape as update: retried delete with a stale `baseVersion` gets `conflict`; if the returned row is already tombstoned at a version this device doesn't recognize as foreign, adopt it as its own earlier success. | Yes, same mechanism as above. |
| `ADOPT_SERVER` / `DELETE_LOCAL` | Process dies between the domain-storage write and the metadata write | Yes | Purely local; a retried reconciliation pass re-derives the identical action from the identical inputs and re-applies it — idempotent by construction (no network round trip involved). |
| `CONFLICT` | N/A — no mutation occurs until resolved | Yes | Re-detecting is a no-op; nothing to lose. |
| `DEFER_UNKNOWN_LEGACY_STATE` | N/A — no mutation occurs until a human decides | Yes | Same shape as `CONFLICT`: re-detecting the same unresolved ancestry question on a later run costs nothing and resolves nothing until deliberately handled. |
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
   without an actual acknowledged sync). This also implements the Case K1/K2 distinction
   (§C, Case K) for free: metadata presence itself becomes the signal separating a
   genuinely-unknown legacy record from one this device knows it just created. No
   reconciliation logic yet — this is purely the metadata-layer prerequisite §E identified.
2. **Server-read contract fixes** (§F) — split each domain's fetch into an ordinary
   (tombstone-filtered) function and a reconciliation-only (tombstone-inclusive,
   version-carrying) function; fix the currently-latent missing `deleted_at` filter on the
   two direct-Supabase ordinary reads; add the missing service method + route for the two
   backend-mediated tombstone-inclusive reads. Pure plumbing, independently testable and
   deployable before any reconciliation logic exists.
3. **Pure decision-table engine** — implement §C/§D as a pure function per domain
   (`(local, metadata, server) -> {action, metadataPatch}`), unit-tested exhaustively
   against every case in §C (now including K1/K2/P/Q/R/T/V) plus the idempotence scenarios
   in §I, with **no** side effects (no AsyncStorage, no network) — a decision function you
   can property-test. **Required regression tests, specifically**: a legacy-record-with-
   no-metadata-and-no-server-row must resolve to `DEFER_UNKNOWN_LEGACY_STATE`, never
   `CREATE_SERVER` (Case K1); a version lower than `lastSeenVersion` must never be treated
   as stale/discarded (Case V, all three sub-rows); a positively-tombstoned server record
   must always win over an ancestry-unknown local copy (Case Q) while an ancestry-unknown
   local copy with merely-absent server state must never be resolved either direction
   (Case K1 vs. Case Q side-by-side, same local state, different server evidence,
   different action — this pair is the core proof that the engine cannot resurrect a
   record a legacy client may have physically deleted).
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

---

## L. Addendum (Phase 2B1) — combinations discovered while implementing step 3

Implementing `lib/reconciliation-decision-engine.ts` against the table above surfaced a
handful of `(isDeleted, isDirty, server state)` combinations the markdown table didn't
explicitly enumerate — all involving a local tombstone (`isDeleted: true`) meeting an
**absent** server (as opposed to Cases F/G/J, which all assumed the server still showed
*something*). Recorded here rather than silently resolved in code only, per this
project's practice of keeping the spec and the implementation honest with each other:

- **Dirty tombstone, server absent** (`isDeleted: true, isDirty: true`, `S=absent`): our
  own pending delete turns out to already be achieved — something (very plausibly a
  legacy hard delete, possibly even our own earlier attempt) already removed the row
  entirely. Resolution: `NO_OP`, clearing `isDirty` (nothing left to push) but leaving
  `lastSeenVersion` alone (there is no successor version to record).
- **Already-settled tombstone, server absent** (`isDeleted: true, isDirty: false`,
  `S=absent`): a tombstone this device already fully acknowledged has since vanished
  entirely. Resolution: `NO_OP`, no metadata change — the outcome still matches our
  intent.
- **Already-settled tombstone, server now active** (`isDeleted: true, isDirty: false`,
  `S=active@V`): another device reactivated the identity *after* our tombstone was fully
  settled. Resolution: `ADOPT_SERVER`. This is deliberately **not** treated as forbidden
  resurrection (invariant B.2): that invariant is about this engine spontaneously undoing
  a local tombstone on its own initiative; it does not forbid adopting a different
  device's already-authoritative, properly-CAS-guarded reactivation when this device has
  no pending claim of its own (`isDirty: false`). Structurally the same shape as Case C.
- **Local-only create-then-delete meets a cross-origin collision**
  (`lastSeenVersion: null, isDeleted: true, isDirty: true`, `S` shows *something*): this
  device created and deleted an identity without ever syncing it, and the server
  unexpectedly already has a row under that exact id. With zero version history for this
  device's own copy, there is no safe CAS action — resolved as `CONFLICT` rather than
  guessed either direction.

All four are covered by dedicated tests in `lib/__tests__/reconciliation-decision-engine.test.ts`.
None required a new named action in §D — each resolves to an action already in the finite
set, just via a code path the original table's case list didn't name individually.
