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

---

## M. Phase 2B2 addendum — the dual-write hazard and the Phase 3 cutover

Phase 2B2 built and exhaustively tested a reconciliation **execution** layer
(`lib/reconciliation-executor.ts`, `lib/reconciliation-adapters.ts`) that can safely carry
out any decision this spec's engine produces. It is **not** wired into the app. This
section documents exactly why activating it today would be unsafe, and exactly what Phase
3 must change first.

### M.1 The dual-write hazard, confirmed

Every legacy mutation path for all four domains still performs a **fire-and-forget direct
cloud write**, unconditionally, with no CAS check at all:

| Domain | Local write | Metadata | Legacy cloud write | Fire-and-forget? | Physically deletes? | Touches `sync_version`? | Can race a reconciliation RPC? |
|---|---|---|---|---|---|---|---|
| saved-outfits | `AsyncStorage.setItem` | `markActive`/`markDeleted` (Phase 1B.1 ordering) | `upsertSavedOutfitToSupabase` / `deleteSavedOutfitFromSupabase` | Yes | Yes (delete) | **No** — the upsert payload never includes `sync_version`/`deleted_at`, so a Supabase upsert's `ON CONFLICT DO UPDATE SET` leaves both columns completely untouched | Yes |
| week-plan | same shape | same | `upsertWeekPlanItemToSupabase` / `deleteWeekPlanItemFromSupabase` | Yes | Yes | No, same reason | Yes |
| closet-outfit-favourites | same shape | same | `upsertClosetOutfitFavouriteToBackend` / `deleteClosetOutfitFavouriteFromBackend` (→ backend's legacy repository `upsertFavourite`/`deleteFavourite`) | Yes | Yes (Prisma `deleteMany`) | No — the legacy Prisma `upsert`'s `update` clause never sets `syncVersion`/`deletedAt` either | Yes |
| closet-outfit-week-plan | same shape | same | `upsertClosetOutfitWeekPlanItemToBackend` / `deleteClosetOutfitWeekPlanItemFromBackend` | Yes | Yes | No, same reason | Yes |

**This confirms, not merely assumes, the hazard the Phase 2B2 brief anticipated.** A legacy
write silently changing content without bumping `sync_version` breaks the one invariant
the entire CAS protocol depends on: *"version N always describes this exact content."* If
the executor were active at the same time as these legacy paths, a legacy write could
change a record's real content while its `sync_version` stayed frozen at whatever it was —
meaning a client that last saw version N would treat that stale version as still
describing the (now different) current content, and a subsequent reconciliation pass could
adopt or CAS against data it has no idea has already changed. **Phase 2B2 must not be wired
into production mutation flows while these legacy writes remain active** — confirmed, not
disproven, by this audit.

There is a secondary hazard beyond per-record races: `lib/user-data-sync.ts`'s
`syncUserDataOnSignIn` also performs bulk legacy `upsertMany*` calls (the existing crude
"push local to cloud if cloud is empty" fallback) — same unconditional-upsert,
no-CAS shape, at a coarser grain.

### M.2 Exact legacy call sites Phase 3 must migrate

This is the Phase 3 migration checklist — every one of these must be replaced with a call
into the reconciliation executor (or retired) before the executor can safely run
alongside, or in place of, ordinary user mutations:

1. `lib/saved-outfits-storage.ts` → `saveSavedOutfit` calls `upsertSavedOutfitToSupabase`
2. `lib/saved-outfits-storage.ts` → `deleteSavedOutfit` calls `deleteSavedOutfitFromSupabase`
   (physical delete)
3. `lib/week-plan-storage.ts` → `assignOutfitToWeekDay` calls `upsertWeekPlanItemToSupabase`
4. `lib/week-plan-storage.ts` → `removeWeekPlan` calls `deleteWeekPlanItemFromSupabase`
   (physical delete)
5. `lib/closet-outfit-storage.ts` → `saveClosetOutfitToFavourites` calls
   `upsertClosetOutfitFavouriteToBackend`
6. `lib/closet-outfit-storage.ts` → `deleteSavedClosetOutfit` calls
   `deleteClosetOutfitFavouriteFromBackend` (→ backend Prisma `deleteMany`)
7. `lib/closet-outfit-storage.ts` → `assignClosetOutfitToWeekDay` calls
   `upsertClosetOutfitWeekPlanItemToBackend`
8. `lib/closet-outfit-storage.ts` → `removeClosetWeekPlanDay` calls
   `deleteClosetOutfitWeekPlanItemFromBackend` (→ backend Prisma `deleteMany`)
9. `lib/user-data-sync.ts` → `syncEntity`'s bulk fallback calls
   `upsertManySavedOutfitsToSupabase` / `upsertManyWeekPlanItemsToSupabase` /
   `upsertManyClosetOutfitFavouritesToBackend` / `upsertManyClosetOutfitWeekPlanItemsToBackend`
10. Backend-side counterparts that stay reachable as long as 5–8 route through them:
    `backend/.../closet-outfit-sync.repository.ts`'s legacy `upsertFavourite`, `deleteFavourite`,
    `upsertWeekPlanItem`, `deleteWeekPlanItem`

### M.3 Desired eventual architecture (Phase 3, not built yet)

```text
Today (unsafe to combine):

  user local mutation
    ├─→ legacy direct cloud write (no CAS, silently stale sync_version)
    └─→ (if the executor were wired in) reconciliation CAS write
        ── both racing, no coordination ──

Target (Phase 3):

  user local mutation
    → durable dirty metadata (already exists: markActive/markDeleted, Phase 1B/1B.1)
    → [outbox intent — not built yet]
    → version-aware CAS mutation (executor + adapters — built in Phase 2B2, not activated)
    → authoritative acknowledgement (applyMetadataPatch — built in Phase 2B2)
    → clear dirty
```

Phase 3's job is to migrate *ownership* of each call site in §M.2 from the legacy path to
this target shape — deliberately, one domain at a time, never running both paths for the
same record concurrently. This is a cutover, not an addition: every item in §M.2 is
removed or redirected, not supplemented.

### M.4 What Phase 2B2 explicitly did NOT do

Per its own scope boundary: no call site above was touched; the executor and adapters were
built and tested in complete isolation from every production mutation flow; no reconciliation
trigger exists anywhere in the app lifecycle (`SIGNED_IN`/`SIGNED_OUT`/hydration/foreground/
background/timers/navigation); no outbox; no retries; no Phase 3C privilege revocation; the
Phase 1A Supabase migration remains unapplied to production. The executor exists as tested,
callable capability only.

## N. Phase 3A1 — saved-outfits pilot cutover

Phase 3A1 is the first phase to actually wire the reconciliation engine/executor into a real
mutation flow. Scope is deliberately narrow: **saved-outfits only** — items 1–2 of §M.2's
checklist. Items 3–10 (week-plan, closet-outfit-favourites, closet-outfit-week-plan, and the
bulk `syncEntity` fallback for those three) are untouched and remain on the legacy
fire-and-forget architecture exactly as §M.1 describes. Running one domain on the new
architecture and three on the old one simultaneously is intentional, not a compromise: it
proves the new architecture against real usage while keeping the blast radius of any
Phase 3A1 mistake confined to a single domain, and the three untouched domains have zero code
changes to review or trust in this phase.

### N.1 Pilot architecture

```text
saveSavedOutfit / deleteSavedOutfit (lib/saved-outfits-storage.ts)
  → local AsyncStorage write (unchanged — still what makes the save/delete feel instant)
  → markActive / markDeleted (unchanged Phase 1B.1 durable-dirty-metadata ordering)
  → best-effort: dynamic import of lib/saved-outfits-reconciliation.ts,
    then reconcileSavedOutfits() — never awaited, never blocks the caller,
    failure is recordError'd (visible) rather than silently swallowed

reconcileSavedOutfits() (lib/saved-outfits-reconciliation.ts) — the ONE orchestration
entry point, also fired from contexts/useAuthSideEffects.ts on HYDRATED/SIGNED_IN:
  → fetchSavedOutfitsForReconciliation() (tombstone-inclusive server read, Phase 2B1)
  → loadSavedOutfits() + getDomainMetadata('saved-outfits') (local read, Phase 1B/2B1)
  → union of every id seen locally, server-side, or in metadata
  → per id, independently: decideReconciliation (pure engine, Phase 2B1)
                            → executeReconciliation (executor + savedOutfitAdapter, Phase 2B2)
  → one bounded redecide retry on 'redecide_required' (reuses the RPC's own fresher
    response, never a second network read, never more than once — §16/M.1's "never
    substitute a fresher version to force a mutation through" still holds)
  → per-id try/catch — one record's unexpected throw becomes an operational_failure
    for that id only, every other id in the batch still gets decided (§13)
```

The legacy `upsertSavedOutfitToSupabase` / `deleteSavedOutfitFromSupabase` calls that used to
run inside `saveSavedOutfit`/`deleteSavedOutfit` are **gone from this path** — not
feature-flagged off, actually removed from the call sites. The functions themselves still
exist in `lib/supabase-data.ts` (untouched, unused) purely as a rollback escape hatch (§N.6).

### N.2 The one lifecycle trigger chosen, and why

`contexts/useAuthSideEffects.ts` already had exactly one checkpoint meaning "an authenticated
session is now available" — the `event === AUTH_EVENT_HYDRATED || event === 'SIGNED_IN'`
branch that sets the analytics/crashlytics user id. `reconcileSavedOutfits()` is fired from
that same branch, not a new standalone one. This deliberately covers HYDRATED (an
already-authenticated cold launch) as well as SIGNED_IN — HYDRATED previously triggered *no*
sync of any kind for saved-outfits (a real, previously-flagged gap; `syncUserDataOnSignIn`
only ever ran on `SIGNED_IN`). Foreground-return was considered and rejected for this phase:
it would be a second, independent trigger with its own timing, adding a second concurrency
surface to reason about for no correctness gain the single-flight design (§N.4) doesn't
already provide via the best-effort post-action call.

`syncUserDataOnSignIn` (`lib/user-data-sync.ts`) no longer includes `'saved-outfits'` in its
domain list — that bulk pull-or-push has no CAS/version awareness at all (§M.1's table), so
leaving it running alongside the new trigger on the exact same checkpoint would be the
uncoordinated dual write this phase's invariant forbids. The other three domains' entries in
that list are untouched.

### N.3 Immediate user-action sync

`saveSavedOutfit`/`deleteSavedOutfit` fire the exact same `reconcileSavedOutfits()` function
as the lifecycle trigger — not a parallel/duplicated decision path (§9). It runs the **full**
saved-outfits batch, not a single-record-scoped variant: the local saved-outfits list is small
enough per user that batch cost is negligible, and reusing one function for both triggers is
simpler and more clearly correct than maintaining two. The call happens via a dynamic
`import('@/lib/saved-outfits-reconciliation')` rather than a static top-of-file import — this
breaks a real module cycle (`saved-outfits-reconciliation.ts` → `reconciliation-adapters.ts`
→ `saved-outfits-storage.ts`), not a style choice.

### N.4 Single-flight / coalescing design

A module-level `activeRun` / `queuedRun` pair in `lib/saved-outfits-reconciliation.ts`
guarantees: (a) at most one batch runs at a time; (b) a caller arriving while a run is already
in flight is never simply joined to that run (its own local write may postdate the snapshot
that in-flight run already took) — instead it is coalesced into exactly one queued follow-up
run guaranteed to start only after the current one finishes, so its fresh snapshot read is
guaranteed to observe every write that happened-before the call; (c) every other caller
arriving during the same active run shares that one queued follow-up rather than each queuing
their own. This means the lifecycle trigger, a user's save, and a concurrent user's delete can
all fire within the same tick and converge onto at most two real batch executions (the one
already running, plus one coalesced follow-up), never three, never a missed write, and never
two batches concurrently mutating the same record. Proven with a deterministic
gate-and-release test (`saved-outfits-reconciliation.test.ts`'s single-flight coalescing
describe block) — no timing-based sleeps.

### N.5 Failure / retry model — no outbox needed (§10)

Every local write is durably marked dirty (`markActive`/`markDeleted`, awaited, uncaught —
Phase 1B.1) *before* `saveSavedOutfit`/`deleteSavedOutfit` even attempt the best-effort sync.
If that attempt fails for any reason (offline, RPC error, an unrelated record's failure),
`isDirty` stays `true` and the record is durably rediscoverable: the very next
`reconcileSavedOutfits()` call — whichever trigger fires it first, lifecycle or another user
action — re-reads the same durable local state and metadata and retries the exact same
decision. This was verified directly, not assumed: `saved-outfits-reconciliation.test.ts`'s
process-death/network-failure tests kill the RPC mid-attempt (create and delete), restart it,
and confirm convergence on the next pass, with a sibling K1-deferred legacy record proven
untouched throughout (never a destructive write, never resolved by looping). No concrete
state was found that survives a process death un-recoverable by this mechanism — a full
outbox (an explicit persisted queue, ordering guarantees, backoff scheduling) would add
complexity without closing any actual gap for this single, low-volume domain, so §10's answer
is: **not built, and not currently needed.** This can be revisited if a later domain's shape
(e.g. one where operation *ordering* matters, unlike saved-outfits' create/delete-only shape)
proves it necessary.

### N.6 Deployment prerequisite and rollback

No feature-flag mechanism was invented. `constants/config.ts` has no existing
runtime-remote-flag convention to reuse (`appConfig.useMockServices` is a build-time env var,
not a runtime toggle), and building one for a single-phase pilot would be exactly the
over-engineering §18 warns against. Instead, this is a **hard deployment prerequisite,
documented here**: the saved-outfits v2 client path (this phase's commit) must not reach
production users before the Phase 1A Supabase migration
(`supabase/migrations/20260907010000_phase1a_version_aware_rpcs.sql`) is applied and verified
against the production Supabase project — without it, `create_saved_outfit` /
`update_saved_outfit` / `delete_saved_outfit` simply don't exist server-side and every
reconciliation attempt for saved-outfits would fail as an operational_failure (harmlessly —
dirty stays true, nothing corrupts — but sync would never actually complete).

Rollback does **not** require reverting this commit's exact code: `upsertSavedOutfitToSupabase`
/ `deleteSavedOutfitFromSupabase` still exist in `lib/supabase-data.ts`, untouched and fully
functional — a future build could re-wire `saveSavedOutfit`/`deleteSavedOutfit` back onto them
in minutes if the new path ever needed to be pulled. This is deliberate: Phase 3C's eventual
revocation of direct-table DML privileges is what will finally retire that escape hatch, and
this phase does not bring that revocation any closer.

### N.7 Phase 2 findings re-confirmed (§Part 1 of Phase 3A1's instructions)

Re-traced against the current repository state before any change in this phase: saved-outfits
remains document-like (create/delete only, no in-place edit in the UI); regeneration
(`useResultsActions.ts`'s `handleRegenerate`) always produces a new id via `buildSavedOutfitId`'s
generation suffix and never mutates or removes the previous generation's saved copy; the
legacy `upsertSavedOutfitToSupabase` never touched `sync_version`/`deleted_at` (confirmed by
reading its actual upsert payload); the legacy `deleteSavedOutfitFromSupabase` was a physical
`DELETE`. No discrepancy from Phase 2's findings was found.

## O. Phase 3A2 — week-plan cutover

Second pilot domain, migrated the same way as §N's saved-outfits — but week-plan is
**slot/keyed state**, not document-like: reassigning an already-synced day (`dayKey`) is a
normal, reachable action, so this phase is the first to exercise `UPDATE_SERVER` and
`REACTIVATE_SERVER` against real concurrent-edit scenarios, not just `CREATE_SERVER`/
`DELETE_SERVER`.

### O.1 Shared orchestration extracted

Once a second domain needed the identical batch-decide-execute loop and single-flight
coalescing §N.4 built for saved-outfits, that shape was extracted into
`lib/domain-reconciliation-runner.ts` (`reconcileDomainRecords` + `createSingleFlightRunner`).
`lib/saved-outfits-reconciliation.ts` and the new `lib/week-plan-reconciliation.ts` are now
both thin per-domain configs (adapter, id extractor, server/local reads, and — week-plan only
— a retention-window `includeId` filter) calling into that shared module. Not a generic
synchronization framework: no registration, no protocol negotiation, no domain discovery —
just the two genuinely domain-agnostic pieces, extracted once real duplication existed, not
speculatively. Each domain still gets its own independent single-flight instance; a stuck or
failing week-plan run never blocks or is blocked by saved-outfits'.

### O.2 The day-rollover pruning hazard, and its fix

`loadWeekPlan()` already silently prunes any day whose `dayKey` has rolled outside the current
7-day retention window (`isFutureWeekDay`), as pure housekeeping — never a tombstone, never
`markDeleted`. Once week-plan gained sync metadata, this created a real, previously-latent
hazard: an expired day the server or a leftover metadata entry still remembered would look
like ordinary internal drift to the decision engine (Case M's "metadata active, object
absent" repair path) and get silently re-downloaded via `ADOPT_SERVER` — right back into local
storage, where the very next `loadWeekPlan()` call would prune it again, forever. Fixed by
giving `reconcileDomainRecords` an `includeId` filter (week-plan supplies
`isFutureWeekDay`, now exported from `lib/week-plan-storage.ts`): an id it rejects is skipped
entirely — never decided, never counted, never mutated — and any leftover metadata entry for
it is opportunistically removed, since the window only ever moves forward and an excluded id
can never become relevant again. Proven with a dedicated test simulating the exact drift state
(active metadata + active server row for an expired day) and confirming zero RPC calls, zero
re-materialization, and metadata cleanup.

### O.3 Bulk `replaceWeekPlan` no longer bypasses reconciliation

`useWeekPlan.ts`'s "local empty → fetch cloud → blindly replace local" fallback (bypassing the
decision engine and sync metadata entirely, per §M's Phase 2A finding) now calls
`reconcileWeekPlan()` and re-reads `loadWeekPlan()` instead of calling
`fetchWeekPlanFromSupabase`/`replaceWeekPlan` directly. `lib/user-data-sync.ts`'s
`syncUserDataOnSignIn` also no longer includes `'week-plan'` in its bulk pull-or-push list, for
the same reason §N.2 removed `'saved-outfits'`. The *other* `replaceWeekPlan` call in that same
hook (persisting each day's refreshed sketch/recommendation content after a per-item network
refresh) is unrelated — a local content refresh, not a cloud-fallback pull — and is
deliberately left untouched, mirroring how Phase 3A1 also left `useFavouritesData.ts`'s
equivalent post-hydration `replaceSavedOutfits` call alone.

### O.4 `assignedAt` semantic-equality: reconfirmed, unchanged

`weekPlanAdapter.compareContent` already excluded `assignedAt` from equality (Phase 2B2).
Reconfirmed deliberately for week-plan now that it's production-relevant: `assignedAt` is
display/business metadata (when the user made this assignment), not part of a day's
synchronization identity — the same outfit assigned to the same day is the same intended
assignment regardless of the exact timestamp recorded, and this is exactly what makes lost-
acknowledgement recovery work after a retry (a genuine retry reconstructs the same content
with a fresh timestamp). Confirmed correct via dedicated tests: a differing-`assignedAt`-only
server response is adopted as this device's own earlier success, while a differing-content
response under the same stale baseVersion remains a genuine conflict.

### O.5 Cutover state after Phase 3A2

```text
saved-outfits             → NEW (version-aware CAS + reconciliation) only
week-plan                 → NEW (version-aware CAS + reconciliation) only
closet-outfit-favourites  → legacy only, untouched
closet-outfit-week-plan   → legacy only, untouched
```

Deployment prerequisite is the same shape as §N.6: the Phase 1A week-plan RPCs
(`create_week_plan_item` / `update_week_plan_item` / `delete_week_plan_item`, same migration
file as saved-outfits') must be live in production before this client code ships. Re-verified
against the current client wrappers line-by-line (arg names/order, composite `(user_id,
day_key)` conflict target, return shape, `SECURITY DEFINER` hardening, grants) — exact match,
no migration changes made. Rollback is the same escape hatch as §N.6: `upsertWeekPlanItemToSupabase`
/ `deleteWeekPlanItemFromSupabase` remain intact and unused in `lib/supabase-data.ts`.

## P. Phase 3A3 — closet-outfit-favourites cutover (first backend-mediated domain)

Third pilot domain. Unlike §N/§O (direct Supabase RPCs), closet-outfit-favourites is
**backend-mediated**: frontend → authenticated HTTP → `closetOutfitSyncService` →
`closetOutfitSyncRepository` → Prisma. All of the version-aware capability (routes, service
methods, repository methods, tombstone-inclusive reconciliation read) already existed from
Phase 1A/2B1/2B2 with zero frontend caller — this phase's job was proving the HTTP-mediated
adapter maps onto the identical executor semantics already proven for direct Supabase, and
wiring the one missing piece: a frontend reconciliation-read wrapper
(`fetchClosetOutfitFavouritesForReconciliation` in `lib/closet-outfit-sync.ts`) — the backend
route (`GET /closet-outfit-sync/favourites/for-reconciliation`) existed but had no frontend
caller until now.

### P.1 Transport contract, confirmed safe

`lib/api/api-client.ts`'s `request()` never throws — it resolves to `{success, data, error}`
always, converting network failures to `success: false`. Critically, every CAS protocol
outcome (`created`, `create_conflict`, `applied`, `conflict`, `not_found`) is returned via
`sendSuccess` (HTTP 200) regardless of which status it is — only a genuine failure
(`requireAuth` rejecting, schema validation, an unexpected exception) produces a non-2xx
response. This means the existing frontend RPC wrappers' `if (!response.success) throw` only
fires on genuine failures, never on a normal protocol outcome — the executor's `try/catch` →
`operational_failure` path and its `status`-based branching never collide. No wrapper code
needed to change to make this safe; it already was.

### P.2 Ownership scoping — the legacy bug stays dead

The legacy `upsertFavourite`'s ownership fix (`where: {id, supabaseUserId}` before falling
through to create) predates this phase and remains untouched. More importantly, every
version-aware repository method (`createFavourite`, `updateFavouriteVersioned`,
`deleteFavouriteVersioned`) was built ownership-scoped from Phase 1A itself — `request.userId`
is server-derived from a signature-verified JWT (`middleware/auth.ts`), never client-supplied,
and every WHERE clause includes it alongside `id`. This is already covered by existing tests
(`closet-outfit-sync.repository.phase1a.test.ts`'s "scopes the WHERE clause by the caller's own
supabaseUserId" cases, `closet-outfit-sync.repository.legacy-ownership.test.ts`) — no new
backend security tests were added; the existing coverage already proves cross-user access
returns `not_found` (never leaking another user's row state) and never mutates another user's
row.

### P.3 Reactivation is real but uncommon

Closet-generated outfit ids are a deterministic function of the exact combination of closet
item ids composing them (`closet-outfits.service.ts`), not a fresh random/timestamp id per
generation. A user who unfavourites an outfit and later regenerates the exact same item
combination reuses the same id — a genuine (if not-guaranteed, since generation is
weighted-random for variety) reactivation path. Tested directly at the reconciliation level
(same `REACTIVATE_SERVER` mechanics already proven for week-plan in §O), independent of
whether the UI's random selection actually reproduces it in practice.

### P.4 Cutover state after Phase 3A3

```text
saved-outfits             → NEW (version-aware CAS + reconciliation) only
week-plan                 → NEW (version-aware CAS + reconciliation) only
closet-outfit-favourites  → NEW (version-aware CAS + reconciliation, backend-mediated) only
closet-outfit-week-plan   → legacy only, untouched
```

`lib/domain-reconciliation-runner.ts` required no changes — the backend-mediated adapter
satisfies the exact same `DomainAdapter<TContent>` interface as the direct-Supabase ones, and
`reconcileDomainRecords`/`createSingleFlightRunner` are already fully generic. No `includeId`
filter: favourites have no retention/archive window (unlike week-plan's rolling 7-day
window) — every favourite identity stays eligible for reconciliation regardless of age.

Deployment order (nothing deployed in this phase): the version-aware favourite backend
capability is **already live in production today** (Phase 1A shipped it additively months
before any client called it) — unlike saved-outfits/week-plan, there is no "deploy the backend
first" step remaining for this domain specifically. The only remaining prerequisite is
verifying the deployed backend's `/closet-outfit-sync/favourites/version-aware*` and
`/for-reconciliation` routes respond as expected before this client build ships — a
production health check, not a code or migration change. Rollback: `upsertClosetOutfitFavouriteToBackend`
/ `deleteClosetOutfitFavouriteFromBackend` remain intact and unused, and the legacy backend
routes/service/repository methods are untouched and still reachable — nothing here removes
backward compatibility for an older installed client.

## Q. Phase 3A4 — closet-outfit-week-plan cutover (final domain; all four migrated)

Fourth and final domain. Combines the two load-bearing properties proven separately in §O
(direct-Supabase, slot/keyed — real `UPDATE_SERVER`/`REACTIVATE_SERVER` concurrency) and §P
(backend-mediated, document-like — HTTP transport contract): closet-outfit-week-plan is
backend-mediated **and** slot/keyed, so this phase is the first to exercise real concurrent-
slot conflicts through the authenticated-HTTP path rather than direct Supabase RPCs.

### Q.1 The lost-ack DELETE audit (§13) — no bug found

This phase's instructions asked for an explicit, skeptical re-check: does
`lib/reconciliation-executor.ts`'s `DELETE_SERVER` conflict branch ever recognize an achieved
deletion by comparing *content* rather than checking for a real tombstone? Re-reading the
code line by line: it does not. The branch checks `result.deletedAt !== null` only — content
(`compareContent`) is never consulted anywhere in the `DELETE_SERVER` case, unlike
`UPDATE_SERVER`/`REACTIVATE_SERVER`'s lost-ack recovery, which explicitly does compare content.
This asymmetry is intentional and correct: only a real server-side tombstone proves a delete
was applied; an active row with matching content could mean someone reactivated it, or the
delete simply never happened despite a coincidentally-matching snapshot read. **No bug existed**
— this was correct from Phase 2B2. One explicit regression test was added to
`reconciliation-executor.test.ts` (an active, content-identical `conflict` response must still
resolve to `CONFLICT`, never `success`) to make this invariant airtight against a future
refactor, since the prior test suite proved the *different-content* case but not the
*identical-content-while-still-active* case specifically.

### Q.2 Rollover expiry — same fix, explicitly re-audited for dirty state

`loadClosetWeekPlan()` prunes locally-expired days exactly like `loadWeekPlan()` (§O.2) — same
hazard, same fix: `includeId: isFutureWeekDay` (now exported from
`lib/closet-outfit-storage.ts`) in the domain config, closing the same Case-M/Case-A
resurrection risk.

This phase explicitly re-examined whether `reconcileDomainRecords`' opportunistic metadata
cleanup for excluded ids is safe when the metadata is still `isDirty: true` (an unresolved
conflict, or a create/update that never got a chance to sync before the day rolled over).
Conclusion: **safe, no change needed**, for two independent reasons. First, the local domain
object is *already* gone by the time this matters — `loadClosetWeekPlan`/`loadWeekPlan` prune
it as pure housekeeping regardless of metadata, so the pending intent has no observable
effect on the device's own UI either way. Second, this app has no conflict-resolution UI at
all (§K/§N.11's "expose a structured result for future resolution" was never built into a
screen) — an unresolved conflict on an expired day was already permanently invisible to the
user before it expired; discarding its metadata doesn't change what the user can see or do,
it only stops a future reconciliation pass from perpetually re-deciding `CONFLICT` for a day
nobody will ever act on again. This reasoning is domain-local (each device's retention window
is its own clock's view, so no cross-device data loss is possible) and was verified directly
with a dedicated test asserting a *dirty* expired id is excluded, uncounted, never mutated,
and has its metadata cleaned up exactly like a clean expired id.

### Q.3 Cutover state after Phase 3A4 — all four domains migrated

```text
saved-outfits             → NEW (direct Supabase, document-like)
week-plan                 → NEW (direct Supabase, slot/keyed)
closet-outfit-favourites  → NEW (backend-mediated, document-like)
closet-outfit-week-plan   → NEW (backend-mediated, slot/keyed)
```

`syncUserDataOnSignIn` (`lib/user-data-sync.ts`) now only bulk-syncs `closet` (plain closet
items — never a sync-project domain). `lib/domain-reconciliation-runner.ts` required no
changes for this fourth domain either — `includeId` (built for week-plan in §O) and the
backend-mediated adapter shape (built for favourites in §P) both already existed and compose
without modification.

### Q.4 Outbox — final decision across all four domains

Re-evaluated globally, not just per-domain: for every one of the four domains, pending intent
after process death is fully reconstructible from (a) the local domain object or its absence,
(b) durable sync metadata (`lastSeenVersion`/`isDeleted`/`isDirty`), and (c) the next lifecycle
or user-action reconciliation pass re-reading both against a fresh server snapshot. No domain
was found where this triple is insufficient — every failure-injection test across all four
domains (create/update/delete network failures, lost acknowledgements, conflicts) converges on
retry without needing a persisted intent queue beyond what sync-metadata-storage.ts already
provides. **A generalized outbox is not currently justified** for any of the four domains.

### Q.5 Deployment prerequisites (nothing deployed)

Direct-Supabase domains: the Phase 1A `saved_outfits`/`week_plan` RPC migration
(`supabase/migrations/20260907010000_phase1a_version_aware_rpcs.sql`) must be live in
production before this client ships (§N.6/§O.5) — re-verified consistent, unchanged.

Backend-mediated domains: the version-aware favourite and closet-week-plan-item routes,
services, and repository methods have been live in production since Phase 1A shipped
additively, with zero client caller until §P/§Q wired them up — the only prerequisite is a
production health check of `/closet-outfit-sync/favourites/version-aware*`,
`/closet-outfit-sync/week-plan/version-aware*`, and both domains' `/for-reconciliation` routes
before this client build ships, not a new deploy or migration.

Neither direct-table Supabase privileges nor backend legacy routes/methods are revoked in this
phase (Phase 3C, not started). All four domains' legacy helper functions remain intact and
callable — a rollback of this client build (or an older installed client still running) would
continue to work unmodified against the legacy paths.

## R. Phase 3B — legacy coexistence safety audit and rollout design

Phase 3A1–3A4 built and migrated all four domains onto the version-aware reconciliation
architecture. This phase asks the question those four phases assumed the answer to: **can a
new version-aware client safely coexist with an older installed client that still uses legacy
mutation paths?** The answer, established below, is **yes — with conditions**, and this
section documents exactly what those conditions are.

### R.1 Same-version content drift — a real correctness hole, found and fixed

The audit's central scenario: a new client acknowledges version N with content A; an old
(legacy) client changes the server row's content to B via its unversioned upsert path
(confirmed, all four domains: every legacy upsert payload omits `sync_version`/`syncVersion`
and `deleted_at`/`deletedAt` entirely, so neither column is touched); the new client's next
reconciliation read sees `server.version === N` (unchanged) but `content === B` (changed).

Re-reading `lib/reconciliation-decision-engine.ts`'s Case B and Case D exactly as they stood
before this phase:

```text
Case B (clean local, server active, cmp==='same'):
  return { action: 'NO_OP', ... }                          // contentEquals never consulted

Case D (dirty local, server active, cmp==='same'):
  return { action: 'UPDATE_SERVER', ... }                   // contentEquals never consulted
```

**Both branches decided purely from `server.version === metadata.lastSeenVersion`, never from
content.** This confirmed both of the audit's hypothesized failures:

- **Case B (clean local):** the engine returned `NO_OP`, meaning the new client would never
  discover B exists — a silent, permanent staleness (not data loss, but the new client's local
  cache and the server disagree forever, invisibly).
- **Case D (dirty local) — the worse case:** the engine returned `UPDATE_SERVER(baseVersion=N)`
  unconditionally. Since the legacy write never advanced `sync_version`, the row's real,
  current version is *still* N — the CAS `WHERE sync_version = N` matches, the update
  **succeeds**, and B is silently overwritten by the new client's edit with no conflict ever
  surfaced. This is a genuine violation of the no-silent-data-loss invariant and would have
  been a release blocker had it shipped unfixed.

**Fix applied** (both cases, in `lib/reconciliation-decision-engine.ts`):

```text
Case B: cmp==='same' -> contentEquals ? NO_OP('B-agrees')
                                       : ADOPT_SERVER('B-same-version-content-drift-adopt')
Case D: cmp==='same' -> contentEquals ? NO_OP-with-ack('D-same-version-already-matches-adopt')
                                       : UPDATE_SERVER('D-local-changed-server-unchanged')  [unchanged]
```

Case B is now **fully closed**: local is clean (no unacknowledged intent to protect), so a
content mismatch at an unchanged version is safely resolved by adopting the server's current
truth while preserving the same version number (§2's "APPLY_SERVER while preserving N" —
proven correct generically, since the pure engine is domain-agnostic; verified per-domain via
`saved-outfits-reconciliation.test.ts`'s dedicated Phase 3B describe block, in addition to the
engine-level table).

Case D is **only partially closable client-side, and this is stated plainly rather than
hidden**: `contentEquals` here compares the local device's *new pending edit* against
whatever the server currently shows. In the ordinary, safe, extremely common case (no drift at
all — I edited, nobody else touched it), the new edit *also* differs from the server's
unchanged prior content. Content mismatch alone cannot distinguish "normal unsynced edit" from
"a legacy write silently changed content at the same version," because this metadata does not
keep a pre-edit content baseline to compare the server's current state against. What the fix
*does* close: if the server's content already exactly matches the local device's intended
edit (a coincidental match, or the executor's own lost-ack scenario reached one step earlier),
nothing is pushed — no wasted RPC round trip, no risk either way. The **irreducible half** of
Case D is documented in §R.10 below, not swept under a false "fully fixed" claim.

### R.2/R.3 Extended compatibility-era state model and protocol invariant

Added directly to `lib/reconciliation-decision-engine.ts`'s top-of-file comment:

> **PROTOCOL INVARIANT (Phase 3B):** version equality is necessary but not sufficient to prove
> state equality during the legacy compatibility era. `server.version === metadata.lastSeenVersion`
> must NOT be read as "local's acknowledged state still equals the server's current state" — a
> legacy write can silently change content while this number stays frozen. Case B and Case D
> consult `contentEquals` for exactly this reason before trusting `cmp === 'same'`. Once
> Phase 3C fully revokes legacy mutation paths, this rule becomes vacuously true (nothing can
> change content without incrementing the version anymore) but is not optimized away now.

Same-numeric-version-but-deletion-state-differs was audited as its own row, not left as
fall-through:

- **Local acknowledged active@N, server tombstone@N:** already explicitly handled by the
  existing Case H (`H-server-deleted-local-unchanged`), whose own comment already anticipated
  this exact anomaly ("a delete happened without incrementing the version... defensively
  treated the same as 'ahead' rather than assumed impossible"). No change needed — confirmed
  correct by a new explicit test, not just inference from the comment.
- **Local acknowledged tombstone@N, server active@N:** falls to the existing
  `settled-tombstone-reactivated-elsewhere` path (`ADOPT_SERVER`). Local has no dirty claim of
  its own to protect (not dirty by definition of "acknowledged, settled"), so adopting is safe
  regardless of *why* the server shows active — whether a genuine version-aware reactivation
  by another device, or a version-lineage reset (§R.4) landing at the same version number by
  coincidence. No data is overwritten by this path (it's a pure local-cache adopt, never a CAS
  write), so the philosophical imprecision ("we don't actually know this is the same
  lineage") carries no destructive consequence. Confirmed correct by a new explicit test.

### R.4 Version-lineage reset re-audited

Case V's existing guard (`server.version < metadata.lastSeenVersion`) does **not** catch a
hard-delete/recreate cycle that happens to land at or above the old `lastSeenVersion` (e.g., a
row deleted at version 7 and recreated fresh — the recreate RPCs always start at version 1,
but repeated recreate cycles, or a low original `lastSeenVersion`, could coincidentally
produce `server.version >= lastSeenVersion` for an entirely different lineage). Traced where
this actually falls through: a clean-local recreation-at-same-version lands in Case B (now
content-checked, §R.1 — safe, since adopting is harmless with no local intent to protect); a
dirty-local recreation-at-same-version lands in Case D (the same irreducible half discussed in
§R.1/§R.10 — client-side detection cannot fully distinguish this from an ordinary edit either,
same underlying limitation, same mitigation path). No new lineage-reset case was added because
the *existing* Cases B/D, once content-aware, already absorb this scenario identically to
ordinary same-version drift — a separate "Case V2" would duplicate logic without adding
protection the fix doesn't already provide.

### R.5 Content-equality strength, reconfirmed

Re-verified each domain's `compareContent` (in `lib/reconciliation-adapters.ts`) excludes only
the domain's own business/display timestamp (`savedAt`/`assignedAt`) — every other field,
including nested `input`/`recommendation`/`outfit`/`formality` objects, participates in
`canonicalDeepEqual`. This was already the deliberate Phase 2B2 choice (proven via
`reconciliation-adapters.test.ts`'s existing "differing recommendation/outfit/formality is NOT
equal" cases) and remains correct for same-version-drift detection specifically: a legacy
write changing *any* meaningful field is exactly the kind of change `contentEquals` must
catch, and it does — no field a legacy write could plausibly touch is excluded from the
comparison. No change was needed here.

### R.6 Decision-engine changes and tests added

Changed: `lib/reconciliation-decision-engine.ts` (Case B, Case D, top-of-file invariant
comment). Tests added: a new "Phase 3B — same-version legacy compatibility drift" describe
block in `lib/__tests__/reconciliation-decision-engine.test.ts` (clean/equal, clean/differ,
clean/unknown, dirty/equal, dirty/differ, dirty/unknown, plus the two deletion-state-anomaly
cases — 8 new table-driven cases, domain-agnostic since the engine is); one new mandatory
regression test in `lib/__tests__/reconciliation-executor.test.ts` proving the `DELETE_SERVER`
path never treats an active, content-identical `conflict` response as an achieved deletion
(§R.9 below — audited, confirmed already correct, test added to keep the invariant airtight);
one new end-to-end orchestration test in `lib/__tests__/saved-outfits-reconciliation.test.ts`
proving the new `sameVersionDrift` observability counter (§R.13) increments correctly through
the real wiring, not just the pure engine. Every prior domain's full test suite (saved-outfits,
week-plan, closet-outfit-favourites, closet-outfit-week-plan, shared runner, all-domains
concurrency) was re-run after these changes — all 272 frontend tests pass.

### R.7 Direct-Supabase server-side compatibility bridge (evaluated, not implemented)

**Option A — version-advance trigger.** A `BEFORE UPDATE` trigger on `saved_outfits`/`week_plan`:

```sql
-- ILLUSTRATIVE ONLY — not applied, no migration file created this phase.
CREATE OR REPLACE FUNCTION enforce_sync_version_advance() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sync_version IS NOT DISTINCT FROM OLD.sync_version THEN
    NEW.sync_version := OLD.sync_version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

This is sound because of how Supabase's `.upsert()` compiles: a legacy payload that never
mentions `sync_version` produces an `UPDATE` whose `SET` clause never touches that column, so
`NEW.sync_version = OLD.sync_version` unconditionally for a legacy write — a reliable, simple
detection signal. The Phase 1A RPCs, by contrast, always set `sync_version = sync_version + 1`
*themselves*, so `NEW.sync_version` already differs from `OLD.sync_version` by the time this
trigger fires, and it correctly skips (no double-increment). A legacy no-op resave (identical
content) would still consume a version number — harmless, just a wasted but correct
`ADOPT_SERVER` cycle on the next reconciliation pass.

**Option B — physical-DELETE-to-tombstone trigger.** A `BEFORE DELETE` trigger that performs
its own soft-delete `UPDATE` and returns `NULL` to cancel the physical delete:

```sql
-- ILLUSTRATIVE ONLY — not applied.
CREATE OR REPLACE FUNCTION redirect_legacy_delete_to_tombstone() RETURNS TRIGGER AS $$
BEGIN
  UPDATE saved_outfits SET deleted_at = now(), sync_version = sync_version + 1 WHERE id = OLD.id;
  RETURN NULL; -- cancels the physical DELETE for this row
END;
$$ LANGUAGE plpgsql;
```

This is a well-established Postgres pattern (a `BEFORE DELETE` trigger returning `NULL`
suppresses the delete for that row) and verified sound on the specific points that matter
here: the row is already lock-held by the in-progress `DELETE`, so the trigger's own `UPDATE`
on the same row is safe (same transaction, no self-deadlock); RLS applies normally to the
trigger's `UPDATE` since it runs in the same session as the original statement (no
`SECURITY DEFINER` needed to bypass anything); and the legacy client's own
`deleteSavedOutfitFromSupabase` only checks `{ error }` — since the trigger causes no error,
the old client perceives an ordinary successful delete, matching what it already believes
happened locally. The version-aware RPCs never issue a raw SQL `DELETE` at all (their own
delete is already an `UPDATE`), so this trigger can only ever fire for genuine legacy deletes
— no interaction risk with the new path.

Both are template-only in this phase; nothing was applied to any migration file or database.

### R.8 Backend-mediated compatibility hardening (evaluated, not implemented)

For `closet-outfit-favourites`/`closet-outfit-week-plan`, the equivalent hardening is *simpler*
than a database trigger because we own the repository code directly:

- `upsertFavourite`/`upsertWeekPlanItem`: add `syncVersion: { increment: 1 }, deletedAt: null`
  to the existing ownership-scoped `updateMany`'s `data` object. Preserves the exact
  request/response shape the legacy route already returns (callers never see a version
  number); only the *database effect* changes. Also means a legacy upsert targeting a
  tombstoned id would now correctly reactivate it *and* advance the version — which the
  already-fixed Case C/Case M paths handle correctly on the new client's next reconciliation
  pass (no new client-side work required).
- `deleteFavourite`/`deleteWeekPlanItem`: change the physical `deleteMany` to an
  ownership-scoped `updateMany` setting `deletedAt: new Date(), syncVersion: { increment: 1 }`.
  Same signature, soft effect.

Risk assessment: low. No RLS/SECURITY DEFINER concerns (already-owned application code, not a
new database object); the only behavioral risk is that these two methods' *own* existing unit
tests (`closet-outfit-sync.repository.legacy-ownership.test.ts`) assert the *current*
physical-delete/no-version-touch behavior and would need updating alongside the change — not
done this phase, per the "do not implement" instruction.

### R.9 Lost-acknowledgement DELETE semantics — re-audited, no bug found

Explicitly re-verified (§R.6 lists the test added): `reconciliation-executor.ts`'s
`DELETE_SERVER` conflict branch checks `result.deletedAt !== null` — a real, authoritative
tombstone — before recognizing a delete as already achieved. It **never** consults
`compareContent` on this branch, unlike `UPDATE_SERVER`/`REACTIVATE_SERVER`'s lost-ack
recovery, which explicitly does. An active row with content identical to what was being
deleted is therefore always `CONFLICT`, never treated as a successful deletion — confirmed by
a new mandatory regression test, not merely re-reading the code. **This bug did not exist**;
the executor was correct from Phase 2B2. The gap was in test coverage (no test exercised the
"still-active, content-identical" sub-case specifically), now closed.

### R.10 `assignedAt`/business-timestamp equality, reconfirmed for closet-outfit-week-plan

Re-verified against the actual model rather than assumed from ordinary week-plan's precedent:
`closetOutfitWeekPlanAdapter.compareContent` excludes only `assignedAt`, matching ordinary
week-plan's own adapter. The same reasoning applies identically — `assignedAt` is display
metadata recording *when* an assignment happened, not part of a day's synchronization identity,
and this is exactly what makes lost-acknowledgement recovery work (a genuine retry
reconstructs the same content with a fresh timestamp). No change made; confirmed, not assumed,
via the same paired lost-ack/genuine-conflict test pattern already proven for ordinary
week-plan, now also exercised for closet-outfit-week-plan.

### R.11 Three rollout strategies, compared

**Strategy A — immediate Phase 3C cutoff.** Deploy the new client, then quickly revoke legacy
mutation paths. Rejected as a starting strategy: any still-installed old client (which cannot
be force-upgraded — app-store rollout takes days, and users can defer updates for weeks) would
have its writes rejected outright the moment enforcement lands, with zero visibility into how
many users that affects (§R.16's finding: no client-version telemetry exists today). This
trades a *known, bounded* coexistence risk (§R.1, now closed for the clean case and mitigated
for the dirty case) for an *unknown, unbounded* breakage risk. Not acceptable as the opening
move.

**Strategy B — compatibility bridge first.** Implement §R.7/§R.8's bridges so legacy writes
themselves become protocol-compliant (version always advances, deletes always soft), deploy
the new client, allow an observed coexistence window, then Phase-3C-disable legacy surfaces
once confidence is established. Most upfront work, but it fixes the *root cause* (unversioned
legacy writes) rather than only detecting its symptoms — old clients keep working completely
unchanged from their own perspective, and new clients get the CAS guarantee back in full,
including Case D's currently-irreducible half.

**Strategy C — client-side detection only, no bridge.** Rely entirely on §R.1's engine fix.
Assessed directly: sufficient for the clean-local half (Case B, now fully closed) but **not**
sufficient for the dirty-local half (Case D's ordinary-edit-vs-drift ambiguity, §R.1) — a real,
if narrower than before, silent-overwrite risk remains under this strategy alone.

**Recommendation: Strategy B, with Strategy C's fix running permanently underneath it as
defense-in-depth — not two competing strategies, one architecture with two complementary
layers.** The bridge fixes server-side version integrity at the root (closing Case D's gap
completely, since a bridge-compliant legacy write can no longer leave `cmp==='same'` while
content differs — the entire scenario Case D can't fully resolve stops occurring). The
client-side check (already shipped this phase) stays active regardless, as a safety net for
anything the bridge doesn't cover (a race between trigger and RPC, an unanticipated code path,
a future legacy surface nobody remembered to bridge). This directly answers §R.12: client-side
detection alone is a **necessary temporary defense**, not a **sufficient architecture** — full
safety requires the server-side bridge.

### R.12 Old-client tombstone-read compatibility — a real, lower-severity gap

Traced what an old, currently-installed client's own read query actually does: before this
session's Phase 2B1 fix, `fetchSavedOutfitsFromSupabase`/`fetchWeekPlanFromSupabase`
equivalents had **no** `deleted_at` filter at all. The currently-shipped app binary is exactly
that pre-fix code — its query returns every row regardless of `deleted_at`, meaning **a row a
new client tombstones would still appear active in an old client's UI** until that device
updates. The same is true for the backend-mediated domains (an old client's `GET
/closet-outfit-sync/favourites` route, unless *also* bridged, has no `deletedAt` filter of its
own either — though this route lives in code we control, so it's actually already correct
today: `closetOutfitSyncService.getFavourites`/`getWeekPlan` already filter
`deletedAt: null`, confirmed by reading the service). So this gap is **direct-Supabase-only** —
the backend-mediated domains' legacy reads are already tombstone-safe because that server code
is ours and was fixed alongside the rest.

For direct Supabase: RLS cannot selectively hide rows based on client *version* (RLS policies
key off the authenticated user, not which binary is asking — both old and new clients
authenticate identically). A Postgres view or table-rename redirect could theoretically hide
`deleted_at` rows from everyone uniformly, but an old client's hardcoded table name can't be
redirected without shipping it new code — the same chicken-and-egg problem the underlying
migration has. Severity assessment: this is a **display-layer inconsistency, not a data-loss
or CAS-integrity risk** — the tombstone itself is recorded correctly and the new client's own
reads/reconciliation are unaffected; the only exposure is a single physical user running an
old client on one device and a new client on another, where a soft-deleted item could
reappear in the old device's list until it updates. Documented as an accepted, temporary,
self-resolving-on-update limitation — not a release blocker, but real and worth stating
plainly rather than assuming the read-side fix from earlier phases covers every surface.

### R.13 Old-client write-to-tombstone behavior

Traced for all four domains: a legacy upsert targeting an id the new protocol has already
tombstoned does **not** reactivate it (`deleted_at`/`deletedAt` is never in the legacy
payload, so it stays set) but **does** silently mutate the tombstoned row's hidden content
fields. This is invisible to the new client's ordinary reads (correctly filtered) and, by
design, to Case J's settled-tombstone-agreement path too (it only compares version/deletion
state, never content — a tombstone's content has no user-facing meaning to any client, old or
new, so this was never a gap worth closing symmetrically with Cases B/D). A legacy *physical
delete* targeting an already-tombstoned row does what a physical delete always does — removes
it outright, exactly the hard-delete/recreate scenario Case V already exists to handle safely.
Closing the "silent content mutation under a tombstone" gap is a natural side effect of §R.7/
§R.8's bridge (version would advance, surfacing via the already-correct Case C/M paths) —
not a reason to build anything new in this phase.

### R.14 Production deployment order (nothing deployed)

**Direct-Supabase prerequisites, in order:**
1. Apply the already-written, already-reviewed Phase 1A migration
   (`supabase/migrations/20260907010000_phase1a_version_aware_rpcs.sql`) via the Supabase SQL
   Editor (still the only path to this database — confirmed no automated pipeline exists,
   Phase 0's finding).
2. Run §R.15's verification script — confirms all 6 RPCs exist with correct signatures/return
   shape/owner/`prosecdef`/grants.
3. Confirm direct legacy DML (`INSERT`/`UPDATE`/`DELETE` on the base tables) remains available
   to `authenticated` — nothing here revokes it; this is a compatibility-era prerequisite, not
   an oversight.
4. Confirm reconciliation-tombstone reads work under RLS (an owner can see their own
   tombstoned rows via the plain table, since `fetchXForReconciliation` does a bare
   `SELECT *` with no view/policy indirection).
5. Re-verify against a disposable local Postgres instance **only if** migration SQL changed
   since the last such verification (it hasn't, this phase) — otherwise the existing Phase 1A/
   1B.1 verification stands.

**Backend prerequisites, in order:**
1. Confirm the actually-deployed backend (Render, `style-assistant-api`) contains this
   session's code — **it currently does not**: every phase from Phase 0 through this one is a
   local-only commit on `main`, never pushed, so production today predates all of it.
   Deploying requires pushing to `main` (or `dev` first), which this phase explicitly does not
   do.
2. `backend/scripts/smoke-build.mjs` green against the real compiled app (already re-confirmed
   this phase — no backend code changed, so no new risk introduced, but re-run again
   immediately after the eventual real deploy, not just locally).
3. Authenticated route probes against the deployed instance for
   `/closet-outfit-sync/favourites/version-aware*` and `/week-plan/version-aware*` (a simple
   create/delete round trip with a disposable test id, verified then cleaned up) — confirms
   the routes are actually reachable in the deployed environment, not just present in the
   source tree.
4. Verify ordinary-vs-reconciliation reads against the deployed instance (create → soft-delete
   → confirm absent from the ordinary list, present in `/for-reconciliation`).
5. Verify legacy routes still respond normally (no regression from whatever this deploy
   contains) — since Phase 3A3/3A4 never modified legacy backend code, this should be a
   no-op confirmation, not a real risk.

**Client:** only released once every item above is green. The client release must never be
the first test of server readiness — this ordering is deliberate, not incidental.

### R.15 Production verification checklist (read-only SQL script design)

A single, repeatable, read-only SQL script — queries `pg_proc`/`information_schema`/`pg_class`
only, mutates nothing, safe to run against production at any time:

```sql
-- Phase 3B production verification script (READ-ONLY — proposal only, not run).
-- Run in the Supabase SQL Editor after applying the Phase 1A migration.

-- 1. All 6 RPCs exist, with the exact expected argument list.
SELECT p.proname, pg_get_function_arguments(p.oid) AS args, pg_get_function_result(p.oid) AS returns
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('create_saved_outfit', 'update_saved_outfit', 'delete_saved_outfit',
                     'create_week_plan_item', 'update_week_plan_item', 'delete_week_plan_item')
ORDER BY p.proname;
-- Expect: 6 rows. Compare args/returns manually against lib/supabase-data.ts's RPC wrappers.

-- 2. SECURITY DEFINER + owner + pinned search_path, all 6.
SELECT p.proname, p.prosecdef, r.rolname AS owner, p.proconfig
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_roles r ON r.oid = p.proowner
WHERE n.nspname = 'public' AND p.proname LIKE '%saved_outfit%' OR p.proname LIKE '%week_plan_item%';
-- Expect: prosecdef = true, owner = the intended service owner (e.g. postgres),
-- proconfig containing 'search_path=' (pinned, never the caller's default).

-- 3. EXECUTE grants: authenticated has it, anon/PUBLIC do not.
SELECT routine_name, grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE routine_schema = 'public'
  AND routine_name IN ('create_saved_outfit','update_saved_outfit','delete_saved_outfit',
                        'create_week_plan_item','update_week_plan_item','delete_week_plan_item')
ORDER BY routine_name, grantee;
-- Expect: only 'authenticated' listed per routine, never 'anon' or 'PUBLIC'.

-- 4. sync_version / deleted_at columns exist with correct defaults.
SELECT table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('saved_outfits','week_plan')
  AND column_name IN ('sync_version','deleted_at')
ORDER BY table_name, column_name;

-- 5. RLS still enabled on both base tables (never disabled by mistake).
SELECT relname, relrowsecurity FROM pg_class
WHERE relname IN ('saved_outfits','week_plan');
-- Expect: relrowsecurity = true for both.

-- 6. Direct legacy DML still available to authenticated (compatibility-era requirement —
--    confirms nothing has been prematurely revoked).
SELECT table_name, privilege_type FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name IN ('saved_outfits','week_plan')
  AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;
-- Expect: SELECT, INSERT, UPDATE, DELETE all present today (Phase 3C, not this phase, is
-- what will eventually narrow this).
```

Cross-user leak behavior (RPC returning `not_found` rather than another user's row/state for a
guessed id) is **not** re-verified by this read-only script — it requires actually invoking
the RPCs as two different authenticated test users, which is exactly what Phase 1A's own
disposable-Postgres test suite already did exhaustively; re-running that suite (not a
production probe) is the right verification method for that specific property, and it already
passes.

### R.16 Rollout telemetry

Reused, not rebuilt: every domain's `{domain}-reconcile: started`/`completed ...` log lines
(via `lib/auth-event-log.ts`, already non-content, non-token, already distinguishable per
domain) are the existing signal surface. This phase adds two new counters to
`ReconciliationRunSummary` (`lib/domain-reconciliation-runner.ts`), now included in that same
completion log line:

- **`sameVersionDrift`** — count of records where `cmp==='same'` but content genuinely
  differed (Case B/D's new branches firing). This is the single most direct measurement of
  *how much active legacy-client mutation is still happening in the wild* — a live, per-run
  signal of real-world coexistence pressure, not a guess.
- **`versionLineageReset`** — count of records hitting Case V (hard-delete/recreate lineage
  anomalies).

Alongside the already-existing `considered`/`success`/`noOp`/`dirtyRemaining`/`conflicts`/
`deferred`/`operationalFailures`. No payload, recommendation text, closet content, or
unnecessary user identifiers are logged (unchanged from Phase 3A1's original design) — no
dashboard or analytics platform integration is built in this phase, per instructions; these
remain structured log lines for a human (or a future pipeline) to read.

**Healthy rollout:** `operationalFailures` rate low and flat; `conflicts` present but
attributable to genuine multi-device use, not spiking; `dirtyRemaining` trending toward zero
within a session or two; `sameVersionDrift` present (expected, proves the client-side defense
is doing its job) but not the dominant outcome type.

**Stop-rollout signal:** a sustained spike in `operationalFailures` (infrastructure/protocol
failure — e.g., RPC signature mismatch, auth failures, migration not actually applied) —
distinct from `conflicts`, which are expected, user-level, and not an application failure. A
single concurrent week-plan reassignment conflict is normal product behavior, not a bug.

**Rollback signal:** `operationalFailures` at or near 100% for a domain (e.g., every RPC call
failing) — almost always means the migration/deploy prerequisite in §R.14 was missed for that
domain specifically; the fix is completing that prerequisite, not necessarily rolling back the
client (rollback is reserved for a case where a hidden client-side crash/dataloss appears, not
for "RPC unreachable," which self-resolves once the actual prerequisite lands).

### R.17 Recommended concrete thresholds

Initial, revisable numbers (not "when error rates are low"):

| Signal | Healthy | Investigate | Stop rollout |
|---|---|---|---|
| `operationalFailures` / `considered` (per domain, per day) | < 2% | 2–10% | > 10% sustained over 1 hour |
| `sameVersionDrift` / `considered` | any value, informational | — | — (never a stop signal by itself; see §R.11's Strategy B) |
| `conflicts` / `considered` | < 5% (expected, user-level) | — | — (never a stop signal; a spike here means users are multi-device, not that the protocol is broken) |
| `dirtyRemaining` at end of a lifecycle reconciliation run | < 1% of considered | 1–5%, same domain, repeated sessions | > 5% sustained across sessions for the same domain |
| Runtime smoke (`smoke-build.mjs`) | green | — | any red (immediate stop, this is infra, not user behavior) |
| Auth failures attributable to sync routes specifically (distinct from ordinary 401s) | 0 above background rate | any sustained increase | — |

`conflicts` and `sameVersionDrift` are deliberately never stop-rollout signals on their own —
they represent expected protocol behavior (real competing edits, real legacy-client activity),
not failures of the new architecture.

### R.18 Observation window

No app-store adoption or client-version telemetry currently exists (§R.19's finding) — the
window recommendation below is therefore a conservative time-based estimate, not a
measurement, and this is stated explicitly rather than presented as more precise than it is.
Recommend **at minimum 4–6 weeks** after the new client reaches 100% of the App Store rollout
before considering Phase 3C: mobile app adoption curves typically see 80–90% of *active* users
update within 2–4 weeks of a release reaching 100%, with a long tail of stragglers (inactive
devices, auto-update disabled, offline devices) extending well beyond that. This app has no
forced-minimum-version enforcement today (confirmed: no version check anywhere in
`backend/src/middleware`), so an old client, once installed, keeps working indefinitely until
its user manually or automatically updates. §R.19 identifies closing this measurement gap as
an actual prerequisite for turning "4–6 weeks, a guess" into a data-driven decision.

### R.19 How we'll know old clients are (mostly) gone

Audited what currently exists: **nothing**. `lib/api/api-client.ts` sends no app-version
header; no backend middleware logs or tracks one; `app.config.ts` has a `version` field
(`0.0.6`) but it is never transmitted. This is a genuine, confirmed gap, not invented — and
the recommendation is correspondingly minimal, not an elaborate analytics system: add a single
`X-App-Version` request header (from `expo-constants`/`app.config.ts`'s existing version
field) in `api-client.ts`, and have the backend's already-existing request-logger middleware
include it in its structured log line. This alone would let version distribution of *incoming
traffic* be observed over time without any new infrastructure, app-store analytics
integration, or dashboard. Not implemented this phase (out of this phase's allowed scope,
§23) — recommended as a concrete, small prerequisite for a data-driven Phase 3C decision
rather than a time-based guess alone.

### R.20 Phase 3C planning — direct Supabase (planning only, nothing executed)

For `saved_outfits`/`week_plan`, the eventual enforcement:

```sql
-- PLANNING ONLY — not executed, no migration file created or modified this phase.
REVOKE INSERT, UPDATE, DELETE ON public.saved_outfits FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.week_plan FROM authenticated;
-- SELECT is preserved (both ordinary reads and reconciliation reads still need it).
-- authenticated's EXECUTE on all 6 Phase 1A RPCs is untouched — they run SECURITY DEFINER
-- as their own owner regardless of the caller's direct-table grants, so revoking direct DML
-- does not affect the RPCs' own ability to mutate the tables.

-- Rollback:
GRANT INSERT, UPDATE, DELETE ON public.saved_outfits TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.week_plan TO authenticated;
```

Old-client effect: any remaining old client's direct upsert/delete would start failing with a
permissions error at the database level (RLS/grant denial) — this is *the point* of Phase 3C,
and is exactly why §R.18's observation window must have elapsed first. Verification
statements: §R.15's script, items 3 and 6, re-run post-revocation — item 6 should now show
only `SELECT` for `authenticated`.

### R.21 Phase 3C planning — backend-mediated domains (planning only)

For `closet-outfit-favourites`/`closet-outfit-week-plan`, recommend the **simplest,
operationally reversible** method: a single boolean config flag
(e.g. `LEGACY_CLOSET_SYNC_ENABLED`, read once at process start from an environment variable,
matching this backend's existing `config/env.ts` pattern) that the four legacy route handlers
check before executing — returning a clear `426 Upgrade Required`-style structured error
(reusing `sendError`) instead of performing the legacy mutation when disabled. This is
preferred over deleting the routes/handlers outright (not reversible without a redeploy) or a
minimum-client-version check (requires the version telemetry from §R.19 to exist first, and is
a heavier mechanism than this decision currently needs). Toggling the env var and restarting
the service is a same-day, fully reversible action — no code deploy required to flip it back.

### R.22 Phase 3C rollback

Direct Supabase: the `GRANT` statements in §R.20 are the exact, tested reverse of the
`REVOKE` — both are simple, idempotent, single-statement operations with no data-shape
concerns (rollback never touches rows, only permissions).

Backend: flipping `LEGACY_CLOSET_SYNC_ENABLED` back to true and restarting is the exact
reverse of §R.21 — no code change, no redeploy.

**Data-compatibility concern after a rollback:** by the time any rollback would happen, rows
may already contain tombstones, higher sync versions, or reactivated states the *legacy* code
was never designed to understand. Rolling back the *permission enforcement* does not roll back
*those rows* — an old client regaining direct DML access would interact with them exactly as
§R.12/§R.13 already describe (tombstones invisible to it, its own writes not respecting them).
This is the same coexistence profile the system already ran under during the original
compatibility window, not a new risk introduced by rollback specifically — the rollback
restores the *pre-Phase-3C* state precisely, which was already analyzed and found acceptable
(with conditions) throughout this section.

### R.23 Recommended final rollout architecture

1. **Can we safely ship the new client while old clients exist? Yes, with conditions.** The
   conditions: (a) the same-version clean-local hole is closed (done, this phase); (b) the
   same-version dirty-local hole is a known, narrow, documented residual risk, mitigated but
   not eliminated by client-side logic alone; (c) the server-side compatibility bridge (§R.7/
   §R.8) should be built and deployed **before or alongside** the new client to close that
   residual risk completely, not left as a someday follow-up.
2. **Is client-side same-version drift detection required? Yes — necessary, and already
   shipped.** It is the safety net regardless of whether the bridge exists, and fully
   sufficient on its own for the clean-local half.
3. **Is server-side legacy compatibility hardening required? Yes, for full closure of the
   dirty-local half.** Not required to ship the new client at all (client-side detection makes
   coexistence *reasonably* safe even without it), but required to consider the architecture
   *complete* rather than *reasonably mitigated*.
4. **Should Phase 3C happen immediately or after a compatibility window? After a window.**
   Recommend: ship the server-side bridge (§R.7/§R.8) → ship the new client → observe for the
   window in §R.18 (ideally shortened by adding §R.19's minimal version telemetry) → only then
   plan Phase 3C's actual execution using §R.20–§R.22.
5. **Exact sequence that minimizes risk:** (a) implement and test the server-side bridges
   (§R.7/§R.8) against disposable Postgres + existing backend test conventions; (b) apply the
   Phase 1A migration to production per §R.14/§R.15; (c) deploy the bridged backend to
   production; (d) release the new client; (e) observe per §R.16/§R.17 for §R.18's window,
   adding §R.19's version header in the meantime; (f) plan and execute Phase 3C per §R.20–§R.22
   once observation is satisfactory.

This is one recommendation, not a hedge between alternatives — Strategy B (§R.11), executed in
this order, with Strategy C's client-side fix already in place underneath it throughout.

## S. Phase 3B1 — server-side legacy compatibility bridge (implemented)

Phase 3B (§R.7/§R.8) evaluated the server-side bridge design but did not build it. This phase
implements it: `supabase/migrations/20260908000000_phase3b1_legacy_compatibility_bridge.sql`
(direct-Supabase, additive after Phase 1A, left untouched) and a matching change to
`backend/src/modules/closet-outfit-sync/closet-outfit-sync.repository.ts`'s four legacy methods
(backend-mediated). Nothing pushed, deployed, or revoked — same convention as every prior phase.

### S.1 Legacy contract reconstruction (Part 1)

Direct-Supabase (`saved_outfits`/`week_plan`): confirmed by reading `lib/supabase-data.ts`'s
legacy functions (`upsertSavedOutfitToSupabase`, `upsertManySavedOutfitsToSupabase`,
`deleteSavedOutfitFromSupabase`, and week-plan's equivalents) — every legacy write is a plain
`.upsert()` (content columns only, `sync_version`/`deleted_at` never mentioned) or a bare
`.delete()` (physical row removal). The two tables' original RLS predates this project entirely
(no migration file defines it) — Phase 1A's own migration comment records only that a policy
shaped `auth.uid() = user_id` was confirmed present via `pg_policies` at the time, not its exact
name or whether it was a single `FOR ALL` policy or already split; this phase treats that as the
starting shape to reconstruct from (§S.7).

Backend-mediated (`closet_outfit_favourites`/`closet_outfit_week_plan_items`): confirmed by
reading `closet-outfit-sync.repository.ts`'s four legacy methods (pre-existing this session,
described in the file's own header comments) — `upsertFavourite` does an ownership-scoped
`updateMany` (content only) falling through to `create`; `deleteFavourite` was a physical
`deleteMany`; `upsertWeekPlanItem` uses Prisma's built-in `upsert` against the compound
`(supabaseUserId, dayKey)` key; `deleteWeekPlanItem` was a physical `deleteMany`. Ordinary reads
(`findAllFavourites`/`findAllWeekPlanItems`) already filter `deletedAt: null` — this domain never
had the direct-Supabase read-compatibility problem at all, since the backend fully controls its
own query predicates (no RLS layer to interact with).

### S.2 A major finding: a `deleted_at`-restricted ordinary-read RLS policy breaks legacy reactivation

This phase's original design (matching Phase 3B's §R.7 sketch and this checkpoint's own initial
instructions) was to restrict `saved_outfits`/`week_plan`'s ordinary SELECT policy to
`auth.uid() = user_id AND deleted_at IS NULL`, moving the new client's reconciliation reads
behind dedicated RPCs. Verified against a real disposable Postgres instance (`initdb`/`pg_ctl` at
`/tmp/pgtest-3b1`, torn down after) simulating the confirmed pre-existing single-broad-policy
starting shape (§S.1) — this design **breaks legacy tombstone reactivation**, and does so in two
independent, both-confirmed ways:

1. A plain `UPDATE ... SET deleted_at = now(), sync_version = sync_version + 1` (what a
   version-advance/delete-redirect trigger would need to run) against an RLS-restricted table
   fails with `ERROR: new row violates row-level security policy` even though neither the
   UPDATE-specific policy's `USING` nor its `WITH CHECK` references `deleted_at` at all.
   Isolated down to: PostgreSQL applies the table's SELECT policy against the row an UPDATE
   targets/produces, in addition to the UPDATE-specific policy — proven by removing the
   `deleted_at IS NULL` predicate from the SELECT policy alone (nothing else changed) and
   watching the identical statement succeed.
2. More severe: the legacy client's actual call shape is `.upsert()`
   (`INSERT ... ON CONFLICT (id) DO UPDATE`), not a plain `UPDATE`. Against a tombstoned row
   hidden by a `deleted_at IS NULL` SELECT policy, this raises
   `ERROR: new row violates row-level security policy (USING expression)` outright — Postgres
   can find the conflicting id via the unique index (not RLS-gated) but then cannot satisfy RLS
   to apply the UPDATE arm to it. This is not a corner case: it is *exactly* what happens every
   time a real user re-saves a previously-deleted-then-recreated outfit id, which is precisely
   the case Part 8 of this phase's own instructions required to work.

Both failures reproduce with the restrictive predicate in place and disappear with it removed,
confirmed twice independently (a plain UPDATE and an `ON CONFLICT DO UPDATE`, each tested both
ways). This is a structural property of PostgreSQL row security — no combination of split,
command-scoped policies decouples "visible for an ordinary read" from "visible for a mutation's
row-targeting" on the same table for the same role — not a bug in this migration's trigger logic,
and not something SECURITY DEFINER on the trigger functions can work around either (SECURITY
DEFINER only changes the privileges under which a *nested query the function itself issues* runs;
it does nothing for the *outer* caller-issued statement's own RLS evaluation, which is where the
`ON CONFLICT DO UPDATE` failure occurs).

**Resolution:** `saved_outfits`/`week_plan`'s ordinary SELECT policy is `auth.uid() = user_id`
(ownership-only, matching the ORIGINAL pre-migration shape exactly — not narrowed). Legacy
mutation compatibility (Part 2's invariant) is treated as higher-severity than RLS-level
ordinary-read tombstone-hiding, since a broken reactivation is data-loss-shaped (a legacy user's
save silently or loudly fails) while a stale tombstone reappearing in a bare legacy read is
cosmetic and self-correcting. See §S.3 for how ordinary-read hiding is achieved instead, and
§S.4/§S.11 for the residual gap this leaves and why it's accepted.

This finding also meant the two trigger functions (`enforce_legacy_write_protocol`,
`redirect_legacy_delete_*`) do **not** need `SECURITY DEFINER` after all — their internal writes
are ordinary RLS-compliant statements once the SELECT policy is ownership-only, so they run as
plain `SECURITY INVOKER` (the default), avoiding unnecessary privilege elevation.

### S.3 Final architecture, direct-Supabase

- **Ordinary SELECT** (`{table}_select_own`): `auth.uid() = user_id`. Unchanged in shape from the
  reconstructed original (§S.1) — this migration does not narrow it. Tombstone-hiding for
  *ordinary UI reads* is enforced one layer up, in application code: `lib/supabase-data.ts`'s
  `fetchSavedOutfitsFromSupabase`/`fetchWeekPlanFromSupabase` both already add
  `.is('deleted_at', null)` (Phase 2B1), true for every build of this app from Phase 2B1 onward,
  independent of any RLS predicate.
- **INSERT/UPDATE/DELETE** (`{table}_{insert,update,delete}_own`): ownership-only, unchanged in
  shape and behavior from before this migration.
- **`enforce_legacy_write_protocol()`** (`BEFORE UPDATE`, both tables): if the UPDATE statement
  did not itself explicitly advance `sync_version` (the only way this happens via SQL is a
  legacy upsert's conflict-update arm, which lists only content columns — every one of Phase 1A's
  six RPCs always explicitly sets `sync_version = old + 1`, so they never trigger this branch),
  bump it by one and clear `deleted_at` (a legacy write's whole purpose is "this record is active
  with this content" — reactivation, matching Phase 1A's own update RPCs' existing "a
  version-matched update against a tombstone unconditionally clears `deleted_at`" behavior).
- **`redirect_legacy_delete_saved_outfits()` / `redirect_legacy_delete_week_plan()`**
  (`BEFORE DELETE`, one per table for the differing WHERE shape): if the target row is not
  already tombstoned, run an internal `UPDATE ... SET deleted_at = now(), sync_version += 1`,
  then `RETURN NULL` to cancel the physical delete. Idempotent by construction — if
  `OLD.deleted_at` is already set, no UPDATE runs at all (no version churn), and the physical
  delete is still cancelled.
- **`get_saved_outfits_reconciliation_state()` / `get_week_plan_reconciliation_state()`**: new
  `SECURITY DEFINER` RPCs, ownership derived from `auth.uid()` (never a client-supplied id),
  `SET search_path = ''`, owned by `postgres`, least-privilege `EXECUTE` grants (`authenticated`
  only, explicit `REVOKE` from `PUBLIC`/`anon`). Given §S.2's finding, a plain
  `.from(table).select('*')` would *already* return the caller's own tombstoned rows too — these
  RPCs are not the only path that can see a tombstone the way originally assumed. Kept anyway for
  three independent reasons: an explicit schema-locked output contract; decoupling the new
  client's reconciliation path from whatever the ordinary SELECT policy becomes in a future phase
  (so a later, narrower Phase 3C policy change doesn't also have to remember this read path); and
  consistency with Phase 1A's six CAS RPCs, which already use this exact shape.

### S.4 Old-client ordinary-read compatibility, all four domains (Part 3, revised conclusion)

- **saved_outfits / week_plan**: closed for every client build from Phase 2B1 onward (query-level
  `.is('deleted_at', null)` filter, unconditional). Not closed at the RLS layer, and — per §S.2 —
  cannot be, without breaking legacy reactivation. The residual population is a build that
  predates Phase 2B1's filter entirely: since none of this sync work (Phase 0 through this
  checkpoint) has ever shipped, that population is the *currently live production app itself*.
  This is the same gap Phase 3B's own review already found and deferred (§R.12); this checkpoint
  adds the proof that closing it at the RLS layer is actively incompatible with legacy mutation
  compatibility, not merely unattempted. The correct closure is a **deployment-order guarantee**
  (§S.9), not a database predicate: ship this same release — the release that first makes any
  tombstone possible at all — to every installed client before any tombstone can be created, and
  the population that could ever observe the gap is empty by construction.
- **closet-outfit-favourites / closet-outfit-week-plan**: already closed, no change needed —
  `findAllFavourites`/`findAllWeekPlanItems` already filter `deletedAt: null` in the Prisma query
  itself (confirmed unchanged, §S.1), and this domain has no RLS layer for a restrictive filter
  to conflict with in the first place.

### S.5 Backend-mediated bridge (Parts 14–17)

`closetOutfitSyncRepository`'s four legacy methods, in
`backend/src/modules/closet-outfit-sync/closet-outfit-sync.repository.ts`:

- **`upsertFavourite`**: the ownership-scoped update arm's `data` now also includes
  `syncVersion: { increment: 1 }, deletedAt: null` — reactivation on write, same semantic
  decision as the direct-Supabase domains. No ambient DB trigger exists in this domain (Prisma/
  Postgres via application code only, no RLS, no DB-level triggers) — the increment is written
  directly into this method's own query, so there is no shared mechanism it could double-fire
  through, and no interaction whatsoever with `updateFavouriteVersioned`'s independent CAS
  increment (a different method, a different `WHERE`, never both invoked for the same call).
- **`deleteFavourite`**: changed from `deleteMany` (physical) to `updateMany` (soft), scoped by
  `{ id, supabaseUserId, deletedAt: null }` — the `deletedAt: null` guard is what makes a repeated
  legacy delete idempotent (a second call matches zero rows, no version churn).
- **`upsertWeekPlanItem`**: the `update` branch of Prisma's built-in `upsert` now also sets
  `syncVersion: { increment: 1 }, deletedAt: null`. Week-plan is a mutable single slot per day
  (Part 8's explicit reasoning point) — "assign an outfit to Monday" legitimately means "Monday's
  slot is now this, regardless of what it was before," so reactivation-on-write is the correct
  semantic here too, not merely a copy of the favourites decision.
- **`deleteWeekPlanItem`**: changed from `deleteMany` to `updateMany`, scoped by
  `{ dayKey, supabaseUserId, deletedAt: null }` — preserves the compound
  `(supabaseUserId, dayKey)` identity (Part 16) rather than freeing the `dayKey` for reuse, and is
  idempotent the same way as `deleteFavourite`.

Verified: `closet-outfit-sync.repository.legacy-ownership.test.ts` updated for the new `data`/
`where` shapes (ownership-scoping tests unaffected, since ownership scoping was already correct
and untouched); new `closet-outfit-sync.repository.phase3b1-bridge.test.ts` covers the week-plan
legacy methods' bridge behavior, reactivation, idempotent repeat-delete, and — the explicit
Part 17 requirement — that `updateFavouriteVersioned` (a version-aware CAS method) still
increments `syncVersion` by exactly one, unaffected by the legacy bridge change (there is nothing
for it to be affected by, since the two code paths share no mechanism). Backend suite: 160 passed,
1 pre-existing skip; backend typecheck and `scripts/smoke-build.mjs` runtime smoke both clean.

### S.6 Client reconciliation-read transport change (Parts 4/20)

`lib/supabase-data.ts`'s `fetchSavedOutfitsForReconciliation`/`fetchWeekPlanForReconciliation`
now call `supabase.rpc('get_saved_outfits_reconciliation_state')`/
`supabase.rpc('get_week_plan_reconciliation_state')` instead of a direct
`.from(table).select('*')`, mapping the `out_*`-prefixed response columns into the exact same
`SavedOutfitServerSnapshot`/`WeekPlanItemServerSnapshot` shape as before. This is a pure transport
change — the decision engine, executor, and both domains' reconciliation adapters needed zero
changes, confirmed by re-running all four domains' reconciliation suites plus the dual-write and
concurrency suites unchanged (§S.8). `lib/__tests__/supabase-data-reconciliation-reads.test.ts`
updated to mock `supabase.rpc` instead of `.from().select()` for these two functions specifically
(the ordinary-read functions are untouched and still mock `.from()`).

### S.7 Real-Postgres test results (Parts 12/13)

Disposable Postgres (`initdb`/`pg_ctl`, Unix socket, torn down after), migrations applied in
order: baseline-simulated-original-schema → Phase 0 → Phase 1A → this phase's migration, all
clean. Full matrix, both tables:

| # | Case | saved_outfits | week_plan |
|---|---|---|---|
| 1 | Legacy create starts at version 1 | PASS | PASS |
| 2 | Legacy active read visible | PASS | PASS |
| 2b | Ownership-only SELECT still returns own tombstone at the RLS layer (by design, §S.2/§S.3 — not an assertion of DB-level hiding) | PASS | n/a (same policy shape; not re-asserted) |
| 3 | Reconciliation RPC sees the tombstone (with `deleted_at` set) | PASS | PASS |
| 4/5 | Cross-user isolation, ordinary read + reconciliation RPC | PASS | PASS |
| 7/7b | Legacy update: content changes, version advances exactly once, repeatable | PASS | PASS |
| 8 | Legacy upsert reactivates a tombstone: version advances exactly once, `deleted_at` cleared | PASS | PASS |
| 9 | Legacy delete → tombstone at the next version, physical row preserved | PASS | PASS |
| 10 | Repeated legacy delete against an already-tombstoned row: idempotent, no version churn | PASS | PASS |

Additional, mandatory tests (§S.7 continued):

- **Concurrent old/new mutation** (mandatory, Part 12's last item): a legacy raw UPDATE (content
  A→B, version 1→2 via the trigger) followed by a new-client CAS `update_saved_outfit` RPC call
  using `base_version=1` (its stale belief) — the RPC correctly returns `out_status='conflict'`,
  `sync_version` stays at 2, content stays B. No double-increment, no silent overwrite.
- **Primary Phase 3B acceptance scenario** (Part 13, mandatory): new client acknowledges A at
  version 4 (via three real CAS `update_saved_outfit` calls); a legacy raw UPDATE then changes
  A→B, landing at version 5 (the bridge in action, confirmed); the new client's own CAS update
  attempt at its stale `base_version=4` (carrying local edit C) is rejected —
  `out_status='conflict'`, `out_sync_version=5`, content remains B. This is the exact failure
  Phase 3B's audit identified as unclosable client-side alone (§R.1's Case D residual) — with the
  bridge installed, the server-side half now guarantees the new client's decision engine receives
  `serverVersion=5 ≠ lastSeenVersion=4`, so it correctly classifies CONFLICT rather than
  UPDATE_SERVER. Client-side classification of that signal is already covered by the existing
  decision-engine suite; this test proves the CAS RPC now gives it the correct signal to
  classify from, closing the loop end-to-end.

Backend-mediated domains do not need disposable-Postgres verification (no RLS layer, no DB
triggers) — covered instead by the mocked-Prisma unit tests in §S.5, matching this repo's
existing convention for that domain (Phase 1A/3A3/3A4 used the same approach).

### S.8 Defense-in-depth retained (Part 21)

Case B's content-aware adopt-on-drift and Case D's content-aware already-matches shortcut
(§R.1), and the `sameVersionDrift`/`versionLineageReset` telemetry counters (§R.6), are
unchanged by this phase. They remain load-bearing for: partial deployment (§S.9) where the
server-side bridge for one or more domains isn't live yet; a future manual data edit or rollback
anomaly bypassing the bridge; and as a second, independent layer catching anything the bridge
itself might miss due to an unforeseen deployment or configuration error. The bridge and the
client-side detection are deliberately overlapping safety nets, not a replacement of one by the
other.

### S.9 Partial-deployment analysis (Part 22)

All four server-side compatibility paths (this phase's Supabase migration, applied; this phase's
backend bridge, deployed) must be green **together** before the new client is released. Named
permutations, all resulting in **must NOT release**:

1. **Phase 1A applied, this phase's Supabase migration not applied**: direct-Supabase legacy
   writes still silently drift unversioned (the original Phase 3B risk, unmitigated at the
   server). New client must not release.
2. **This phase's Supabase migration applied, backend bridge not deployed**: direct-Supabase
   domains are safe; `closet_outfit_favourites`/`closet_outfit_week_plan_items` legacy writes
   still silently drift and legacy deletes are still physical. New client must not release.
3. **Backend bridge deployed, Supabase migration not applied**: backend-mediated domains are
   safe; direct-Supabase domains are not. New client must not release.

Production readiness rule: all four domains' server-side compatibility must be independently
confirmed green (§S.10's verification script covers the two direct-Supabase domains; the backend
bridge's own test suite, §S.5, covers the other two) before the new client ships.

### S.10 Production deployment order and verification script (Parts 11/24)

Deployment order (nothing executed — planning + tooling only, per this phase's own
instructions): (1) apply this phase's Supabase migration via the SQL Editor (same manual
mechanism as Phase 1A — still no automated pipeline reaches this database); (2) deploy the
backend bridge (this is an ordinary code deploy through the existing `main`/`dev` → Render
pipeline, gated by the existing typecheck-then-deploy-hook CI, same as any other backend change);
(3) run the verification script below against production; (4) only then release the new client
build.

Read-only where possible (metadata checks), clearly separated from the two behavioral checks that
need a throwaway test row (each self-cleans):

```sql
-- Phase 3B1 production verification script — extends §R.15's script with
-- this phase's new objects. Run in the Supabase SQL Editor after applying
-- 20260908000000_phase3b1_legacy_compatibility_bridge.sql.

-- 1. Reconciliation RPCs exist, with the expected return shape.
SELECT p.proname, pg_get_function_arguments(p.oid) AS args, pg_get_function_result(p.oid) AS returns
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('get_saved_outfits_reconciliation_state', 'get_week_plan_reconciliation_state')
ORDER BY p.proname;
-- Expect: 2 rows, TABLE(out_* ...) matching lib/supabase-data.ts's mapping.

-- 2. Reconciliation RPCs: SECURITY DEFINER, owner, pinned search_path (same
--    shape as Phase 1A's six RPCs, §R.15's check 2).
SELECT p.proname, p.prosecdef, r.rolname AS owner, p.proconfig
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_roles r ON r.oid = p.proowner
WHERE n.nspname = 'public' AND p.proname LIKE 'get_%_reconciliation_state';
-- Expect: prosecdef = true, owner = postgres, proconfig containing 'search_path=empty'.

-- 3. Reconciliation RPCs: EXECUTE grants — authenticated only.
SELECT routine_name, grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE routine_schema = 'public'
  AND routine_name IN ('get_saved_outfits_reconciliation_state', 'get_week_plan_reconciliation_state')
ORDER BY routine_name, grantee;
-- Expect: only 'authenticated', never 'anon' or 'PUBLIC'.

-- 4. Compatibility triggers attached, enabled, and their functions are
--    plain SECURITY INVOKER (not elevated — §S.2's finding means they
--    don't need to be, and shouldn't be, once the SELECT policy is
--    ownership-only per check 5 below).
SELECT c.relname AS table_name, t.tgname, t.tgenabled, p.prosecdef
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE c.relname IN ('saved_outfits', 'week_plan') AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;
-- Expect: trg_enforce_version_advance (BEFORE UPDATE) and
-- trg_redirect_legacy_delete (BEFORE DELETE) on both tables, tgenabled='O',
-- prosecdef=false.

-- 5. RLS policy set: exactly 4 per table, all ownership-only (no
--    deleted_at predicate anywhere — §S.2/§S.3's resolution).
SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies
WHERE tablename IN ('saved_outfits','week_plan') ORDER BY tablename, cmd;
-- Expect: 8 rows total; qual/with_check each read exactly "(auth.uid() = user_id)",
-- never referencing deleted_at.

-- 6. RLS still enabled on both base tables.
SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('saved_outfits','week_plan');
-- Expect: true for both.

-- 7. Direct legacy DML still available to authenticated (compatibility-era
--    requirement, unchanged from §R.15's check 6).
SELECT table_name, privilege_type FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name IN ('saved_outfits','week_plan')
  AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;
-- Expect: SELECT, INSERT, UPDATE, DELETE all present.

-- ── Behavioral checks (need a throwaway row; each cleans up after itself) ──

-- 8. Ordinary SELECT still returns an owner's own tombstoned row (expected
--    per §S.2/§S.3 — this is NOT a bug, it documents the accepted design).
--    Run as an authenticated test user (not shown: requires a real JWT
--    session, not the SQL Editor's superuser context) — included here for
--    completeness of the checklist, not runnable verbatim in the Editor.

-- 9. Reconciliation RPC sees the same tombstone, cross-user isolation holds.
--    Same caveat as check 8 — requires a real authenticated session per
--    test user; see this phase's disposable-Postgres suite (§S.7) for the
--    already-executed equivalent, which is the actual verification method
--    for this property (same approach §R.15 already established for
--    cross-user leak behavior on Phase 1A's RPCs).
```

Checks 1–7 are pure metadata, safe to run anytime against production with no side effects. Checks
8–9 need an authenticated session per test user (not the SQL Editor's superuser context) and are
better exercised via the disposable-Postgres suite (§S.7, already run) than as a literal
production probe — noted in the script rather than provided as runnable SQL, matching how §R.15
already handled the equivalent cross-user check for Phase 1A's RPCs.

### S.11 Rollback (Part 23)

Documented in the migration file's own header comment (not executed): drop both triggers per
table, drop the three trigger functions and the two reconciliation RPCs, drop all four policies
per table and recreate a single broad `auth.uid() = user_id` `FOR ALL` policy per table to
restore the pre-migration RLS shape exactly. As already true for every rollback in this project:
rollback capability is not rollback risk-free — dropping these objects restores the OLD unsafe
behavior (legacy writes silently drift again) but does **not** undo any tombstone/version state
already produced while the bridge was live; only future writes are affected. Backend rollback is
an ordinary code revert (git revert the repository change) — same caveat: rows already
soft-deleted or version-advanced under the bridge stay that way after a revert; only the method
bodies change.

### S.12 Files changed

- `supabase/migrations/20260908000000_phase3b1_legacy_compatibility_bridge.sql` (new)
- `backend/src/modules/closet-outfit-sync/closet-outfit-sync.repository.ts` (legacy methods
  bridged; version-aware methods untouched)
- `backend/src/modules/closet-outfit-sync/__tests__/closet-outfit-sync.repository.legacy-ownership.test.ts`
  (updated for new `data`/`where` shapes)
- `backend/src/modules/closet-outfit-sync/__tests__/closet-outfit-sync.repository.phase3b1-bridge.test.ts`
  (new)
- `lib/supabase-data.ts` (`fetchSavedOutfitsForReconciliation`/`fetchWeekPlanForReconciliation`
  now call the new RPCs; local `*ReconciliationRpcRow` types added for the `.rpc()` mapping)
- `lib/__tests__/supabase-data-reconciliation-reads.test.ts` (updated for the RPC transport)
- `docs/sync-phase2a-reconciliation-spec.md` (this section)

### S.13 Validation summary

- **Frontend**: `tsc --noEmit` clean; `eslint` clean (one pre-existing, unrelated warning on an
  untouched line); full suite 272/272 passed (26 files), including all four domains'
  reconciliation suites, both dual-write-regression suites, `all-domains-concurrency.test.ts`, and
  the updated `supabase-data-reconciliation-reads.test.ts`.
- **Backend**: `tsc --noEmit` clean; full suite 160 passed, 1 pre-existing skip (17 files),
  including the updated legacy-ownership suite, the new bridge suite, and the untouched Phase 1A
  CAS suites; `scripts/smoke-build.mjs` runtime smoke (Render's own build command, then boot +
  clean SIGTERM shutdown) passed.
- **Database**: disposable-Postgres compatibility migration applied cleanly on top of baseline +
  Phase 0 + Phase 1A; full RLS/trigger/RPC test matrix (§S.7) passed for both direct-Supabase
  domains, including the two mandatory tests (concurrent old/new mutation, primary Phase 3B
  acceptance scenario); instance torn down after.

### S.14 A newly discovered correctness issue, beyond the RLS finding

None beyond §S.2 itself, which is the significant finding of this checkpoint — no additional
correctness gap was found in the decision engine, executor, or the four reconciliation adapters
during this phase's work; §S.6 confirmed the RPC transport change required zero changes to any of
them.

### S.15 Recommended next checkpoint

Phase 3C (frontend/backend migration off the legacy mutation methods entirely, RLS/grant
narrowing, retiring the compatibility triggers) remains explicitly NOT started, per this phase's
own instructions — old clients continue to function, legacy mutation surfaces remain enabled,
direct DML remains permitted. Recommend following §R.23's sequence: deploy this phase's bridge
(Supabase migration + backend) → release the new client → observe per §R.16–§R.19 → only then
plan and execute Phase 3C using §R.20–§R.22, now updated with the concrete bridge this checkpoint
built rather than the sketch those sections evaluated.

## T. Phase 3B2 — production rollout gate + deployment runbook

Phase 3B1 built the server-side bridge. This phase asks a different question: is it actually
safe to deploy it, and what exact procedure gets there. Nothing in this section is deployed,
pushed, or revoked — this is the authoritative rollout runbook the eventual operator follows.

### T.1 Installed legacy-client population — repository evidence

Direct evidence found, not inferred:

- **`eas.json` exists** with a `production` build profile (`autoIncrement: true`) and a
  `submit.production` block — added in its own commit, `2db64608 Add EAS iOS build configuration`.
- **Three explicit TestFlight-bump commits** in history: `888d1f24 Bump version for TestFlight
  build`, `2285dbe1 Bump to v0.0.5 for TestFlight`, `684143fd Bump to v0.0.6 for TestFlight`
  (2026-04-07). `scripts/bump-patch.js`'s own header comment confirms the intended mechanism:
  "EAS autoIncrement (eas.json) handles the native build number separately."
  These are **strong evidence a real TestFlight distribution occurred** — not proof of exactly
  how many testers installed it, whether Apple accepted every submission, or who still has it
  today.
- **`app.config.ts`/`app.json` currently read `version: '0.0.6'`, `ios.buildNumber: '10'`** — no
  version bump since that last TestFlight-labeled commit, ~5 months ago as of this checkpoint.
- **No App Store Connect metadata, fastlane config, screenshots pipeline, or production-listing
  evidence found anywhere in the repo** — nothing suggests a public App Store release ever
  happened; TestFlight-only distribution is the best-supported reading of the evidence.
- **`npm run deploy`** (the actively-documented day-to-day workflow, CLAUDE.md) installs directly
  to one hardcoded device id via `xcrun devicectl device install app` — a separate, single-device
  channel from EAS/TestFlight, not evidence of or against a wider population.
- **No forced-update or minimum-version enforcement exists anywhere** — searched the full
  `app/`, `lib/`, `contexts/`, `hooks/`, and `backend/src` trees for `minimumVersion`/`minVersion`/
  `forceUpdate`/version-gating logic: none found. The only existing app-version usage before this
  phase was a **display-only label** on the Settings screen.
- **Firebase Analytics + Crashlytics are integrated** (`@react-native-firebase/analytics`,
  `@react-native-firebase/crashlytics`, real packages, already wired in `lib/analytics.ts`/
  `lib/crashlytics.ts`) and — per Firebase's own SDK behavior — automatically tag every event and
  crash with the reporting app's version/build, for the **production** bundle id specifically
  (CLAUDE.md documents that the **dev** variant's bundle id mismatch makes Firebase fail to
  initialize there — an accepted soft failure isolated to the dev build, not production). This
  means a real, already-existing external signal for version-adoption distribution likely exists
  in the Firebase console today — but querying it requires operator access this session does not
  have; it cannot be read from repository files.
- **90-day TestFlight build expiration** is a fixed, well-known Apple platform behavior (not
  project-specific, but directly relevant): if v0.0.6/build 10 was genuinely distributed via
  TestFlight around 2026-04-07, that specific build would already be past its 90-day expiration
  window as of this checkpoint (~5 months later) — testers who haven't since installed a newer
  build could no longer be running it at all without the tester having taken some action (there
  is no evidence of a newer TestFlight build ever being cut).

**Verdict: `LEGACY INSTALL BASE UNKNOWN`.** Repository evidence proves a real TestFlight
distribution channel was used historically and gives strong (not certain) reason to believe any
resulting installs are now stale or expired — it does not prove zero installs exist, and this
session cannot query Apple's or Firebase's actual tester/adoption data to close that gap. Per this
phase's own instruction, guessing "no legacy clients exist" merely because the sync commits
themselves were never pushed would conflate two different facts — the backend/database
compatibility work being unshipped does **not** establish anything about which *mobile client
binary* is or isn't installed on a real device right now.

**What would close this gap** (external, cannot be produced from repository files — see §T.6):
App Store Connect → TestFlight → build adoption / tester status; Firebase Analytics' app-version
breakdown for the production bundle id; and, if ever set up, Play Store adoption data (this app is
`ios`-only per `app.config.ts`'s `platforms: ['ios']`, so no Android population exists to check).

### T.2 Path A vs Path B — which is safe today

Per §T.1's verdict, **Path A cannot be selected** — it requires genuinely establishing that no
real user has an older direct-Supabase binary installed, and the evidence available neither
proves nor disproves that. **Path B applies**: legacy installed clients may exist, so the
old-client-DELETE-reappears-as-live-via-a-legacy-SELECT scenario in this phase's own instructions
must be treated as a real risk, not closed. This matches the instruction's own default: "if legacy
clients may exist and there is no forced-update mechanism, treat this as the default safer
approach" — confirmed, no forced-update mechanism exists (§T.1).

### T.3 Is a transitional client release required? Yes.

Given Path B, the two-stage rollout in this phase's own instructions is adopted as the plan,
because the alternative — deploying the Phase 3B1 bridge directly against the current production
Supabase project while an unknown population of pre-Phase-2B1 clients may still be running — has
a concrete, avoidable failure mode: a legacy client soft-deletes something, the tombstone is
correctly created, and that SAME (or another) legacy client's next bare `SELECT *` (no
`deleted_at` filter, since it predates that filter) shows the "deleted" row again as if still
live. This is not a client-side sync bug the reconciliation engine can fix — it is a direct
consequence of an old binary's own query never asking for the filter, and no version of the
Vesture backend/database can filter it away without breaking legacy reactivation (§T.4). The only
mechanism that actually reduces the population capable of observing this is time + adoption of a
build that filters `deleted_at` itself, **before** the bridge starts producing tombstones for
legacy deletes to begin with. Concretely, staged as this phase's own instructions describe:

1. **Stage 1 — compatibility-preparation client.** Ship a build containing only: the
   `.is('deleted_at', null)` ordinary-read filter (`lib/supabase-data.ts`'s
   `fetchSavedOutfitsFromSupabase`/`fetchWeekPlanFromSupabase` — already written, Phase 2B1,
   currently sitting in this same unshipped branch) and the new client-version telemetry headers
   (§T.7, this checkpoint). It must **not** depend on the Phase 3B1 triggers/RLS changes or the
   reconciliation RPCs being live yet — those aren't deployed at this stage. This is achievable
   because `fetchSavedOutfitsFromSupabase`/`fetchWeekPlanFromSupabase` work unchanged against the
   *current* production schema (the `sync_version`/`deleted_at` columns already exist there from
   Phase 0, which — per §T.1's git evidence — is in fact already on `origin/main`'s tip; the
   columns exist, nothing currently sets them to a non-null tombstone, so the filter is a pure
   no-op today and a real protection the moment it isn't).
2. **Stage 2 — observe adoption** of Stage 1 against the criteria in §T.16 before proceeding.
3. **Stage 3 — deploy the Phase 3B1 server bridge** (Supabase migration + backend, §T.8/§T.9) —
   only once Stage 2's bar is met, legacy update/delete semantics start advancing
   `sync_version`/creating tombstones for real.
4. **Stage 4 — release the fully version-aware client** (all four reconciliation domains,
   currently on this branch) once §T.10's server verification passes.

This is the default per the instruction's own fallback rule (no forced-update mechanism, legacy
population unproven-absent) — it is not recommended as a hedge but as the direct consequence of
§T.2's Path B finding.

### T.4 Why RLS still cannot close old-client reads (concise restatement)

Already proven in Phase 3B1 (§S.2) against a real disposable Postgres instance; restated briefly
here since this phase's rollout consequence depends on it. A SELECT policy of
`auth.uid() = user_id AND deleted_at IS NULL` breaks legacy reactivation two independent ways: (1)
PostgreSQL applies a table's SELECT policy against the *resulting* row of an UPDATE, in addition
to the UPDATE-specific policy's own `USING`/`WITH CHECK` — an UPDATE that sets `deleted_at` to a
non-null value fails RLS even though no UPDATE-policy clause references that column; (2) the
legacy client's actual call is `.upsert()` (`INSERT ... ON CONFLICT DO UPDATE`), and against a row
hidden by that restrictive SELECT policy, Postgres can find the id via the (RLS-blind) unique
index but then cannot apply the UPDATE arm to it, raising an outright RLS error — exactly what
happens the moment a real user re-saves a previously-deleted outfit id. Both failures were
reproduced and the fix (an ownership-only SELECT policy, unchanged from the original pre-sync
shape) confirmed to resolve both, on a real database, not merely reasoned about. No untested
PostgreSQL configuration is known that satisfies both requirements simultaneously — this is not
re-opened here per this phase's own explicit instruction not to churn on it further absent a new,
concretely testable idea. The rollout consequence is §T.3.

### T.5 App version / build source

`app.json`'s `expo.version` is the existing canonical semantic-version source
(`scripts/bump-patch.js`'s own comment: "app.json is the single source of truth for the semantic
version"; `app.config.ts` mirrors it at `version: '0.0.6'`). `ios.buildNumber` (`'10'` today) is
the native build identifier, bumped independently, per `eas.json`'s `autoIncrement: true` for real
EAS builds. This phase adds one new module, `lib/app-version.ts`, reading both from
`Constants.expoConfig` exactly once and exporting `APP_VERSION`/`APP_BUILD` plus
`appVersionHeaders()` — the single place both values are computed, so nothing hardcodes a version
string a second time. `app/(app)/useSettings.ts`'s pre-existing `appVersion` display constant now
re-exports `APP_VERSION` from this module instead of independently reading `Constants.expoConfig`
itself, so the Settings screen's visible version label and the HTTP headers are provably the same
value. Dev builds: no special-casing needed — `Constants.expoConfig?.version`/`ios.buildNumber`
resolve from whichever `app.config.ts` branch (`IS_DEV`) built the running binary, so a dev build
naturally reports its own dev-variant version string; no git SHA is used as the version (per this
phase's own instruction) and no existing convention logs one separately, so none was added.

### T.6 Version telemetry implemented, and its hard limitation

**Implemented** (frontend → backend only, narrowly scoped, this checkpoint):
- `lib/app-version.ts` (new) — `APP_VERSION`, `APP_BUILD`, `appVersionHeaders()`.
- `lib/api/api-client.ts` — `ApiClient.request` now attaches `X-App-Version`/`X-App-Build` to
  every request alongside the existing `Content-Type`/`Authorization` headers.
- `backend/src/middleware/request-logger.ts` — every request's existing structured log line
  (`method`, `path`, `statusCode`, `durationMs`) now also carries sanitized `appVersion`/
  `appBuild` fields, read from those two headers. Sanitization: length-capped at 32 chars,
  pattern-restricted to `[A-Za-z0-9._-]+`, else logged as `'invalid'` rather than passed through —
  this endpoint has no auth requirement to even reach the logger, so the header is fully
  attacker-controlled input. Absent headers log `'unknown'`. No payload, token, closet, or outfit
  content is touched — this is the same three existing fields' log line with two more primitive
  string fields, not a new logging system.

**Hard limitation, exactly as this phase's own instructions anticipated**: this only observes
requests that reach the Vesture backend. The two direct-Supabase domains' legacy mutations
(`saved_outfits`/`week_plan`) go straight from the app to Supabase's PostgREST endpoint — the
Vesture backend never sees them, so backend request logs can prove things about
`closet-outfit-favourites`/`closet-outfit-week-plan` client versions but **cannot** prove or
disprove anything about the direct-Supabase legacy population the whole Path B decision (§T.2)
turns on. Backend telemetry is real and useful (it's the correct signal for Stage 1/Stage 4
adoption of the backend-mediated domains, §T.16), but it cannot substitute for the external checks
in §T.1's "what would close this gap" list.

### T.7 Server capability detection

Added narrowly, not as service discovery: `backend/src/modules/health/health.routes.ts`'s
`/health` response gains a static `syncCapabilities` object —
`{ closetOutfitVersionedSync: true, closetOutfitLegacyCompatibilityBridge: true }` today,
declaring what **this deployed build's code** includes (a static fact about the running binary,
bumped by hand alongside each capability's own commit — not a live probe of Supabase/database
state, which would be the service-discovery this phase's instructions explicitly ruled out). The
currently-deployed production backend (as of `origin/main`'s tip, Phase 0 only) predates both
fields entirely — a version-aware client checking for `syncCapabilities.closetOutfitVersionedSync`
and finding the field simply absent gets exactly the right signal ("this server predates sync
support"), without needing a dedicated version-comparison scheme.

### T.8 Client failure behavior when server capability is missing (the actual safety mechanism)

A **reactive** fix, not the `/health` preflight above — the preflight is available for an
operator's own verification tooling (§T.10) but is deliberately **not** wired into the client's
hot reconciliation path, because the reactive fix already fully satisfies the safety principle
without adding a second network round-trip, a cache/TTL, or a new failure mode of its own.

**The actual mechanism** (this checkpoint's real code change, not previously proven — confirmed by
a new test, not merely asserted): all four domains' reconciliation-only server reads now **throw**
on any failure (missing RPC, missing route, permission mismatch, network error) instead of
silently resolving to `[]`. `lib/domain-reconciliation-runner.ts`'s `reconcileDomainRecords` wraps
the fetch step in its own `try`/`catch`; a thrown error aborts the **entire run** before any local
record is read, decided, or mutated, returning `{ ...emptySummary(), skippedReason:
'server-fetch-failed' }` and recording the error via `recordError` for visibility. Concretely:

- **Before this checkpoint**: a missing/failing server read silently looked identical to "this
  user genuinely has zero server records" — the decision engine would proceed to decide every
  local record against a false empty-server picture. This was a real, previously-unproven gap,
  exactly the failure mode this phase's instructions asked to rule out.
- **After**: local-first functionality is completely unaffected (nothing in the local read/write
  path changed); dirty local state remains durable (the aborted run never reaches the metadata
  writes that would have cleared it); the failure is recorded via the existing `recordError`
  crashlytics path for visibility; and — critically — **no fallback to any legacy/unconditional
  write path is attempted anywhere in this flow**, so this cannot recreate the dual-write/
  same-version hole Phase 2B2/3A already removed.

Changed: `lib/supabase-data.ts` (`fetchSavedOutfitsForReconciliation`/
`fetchWeekPlanForReconciliation`), `lib/closet-outfit-sync.ts`
(`fetchClosetOutfitFavouritesForReconciliation`/`fetchClosetOutfitWeekPlanForReconciliation`), and
`lib/domain-reconciliation-runner.ts`. Each of these four fetch functions has exactly one caller
(its own domain's reconciliation module) — confirmed before changing their contract from
"resolves to `[]` on error" to "throws" — so this is not a breaking change for any other consumer.
Proven by new tests: `lib/__tests__/supabase-data-reconciliation-reads.test.ts` and
`lib/__tests__/closet-outfit-sync-reconciliation-reads.test.ts` (throw-on-failure for all four
fetch functions) and a new describe block in `lib/__tests__/saved-outfits-reconciliation.test.ts`
proving `reconcileSavedOutfits()` aborts cleanly end-to-end — dirty metadata untouched, zero RPC
mutation calls attempted — when the fetch rejects.

### T.9 Exact Supabase deployment order (not executed)

By filename, in order, against the production Supabase project's SQL Editor (same manual
mechanism as every prior phase — no automated pipeline reaches this database):

1. `20260907000000_add_sync_version_deleted_at.sql` — additive columns
   (`sync_version`/`deleted_at`) on `saved_outfits`/`week_plan`. **Already effectively a no-op to
   re-verify, not re-apply**, if it was already run against production at some earlier point in
   this project's history — the verification script (§T.10) checks column existence rather than
   assuming; if genuinely not yet applied, this must run first as it's the schema prerequisite
   every later migration and RPC depends on.
2. `20260907010000_phase1a_version_aware_rpcs.sql` — the six CAS RPCs
   (`create_saved_outfit`/`update_saved_outfit`/`delete_saved_outfit`/`create_week_plan_item`/
   `update_week_plan_item`/`delete_week_plan_item`). Prerequisite for step 3 (its trigger/RPC
   definitions assume these columns and this table shape exist).
3. `20260908000000_phase3b1_legacy_compatibility_bridge.sql` — the version-advance trigger, the
   delete-redirect triggers, the reconstructed ownership-only RLS policy set, and the two
   reconciliation-read RPCs (`get_saved_outfits_reconciliation_state`/
   `get_week_plan_reconciliation_state`). This is what actually starts legacy mutations
   participating in the version/tombstone lineage — **do not apply before Stage 1 of §T.3 has met
   its adoption bar**, since this is the step that starts producing real tombstones for legacy
   deletes.

No earlier additive schema migration precedes step 1 — confirmed by `ls supabase/migrations/`
returning exactly these three files, in this filename order, with no gap.

### T.10 Exact backend deployment order (not executed)

The backend deploy is an ordinary code push through the existing pipeline (CLAUDE.md: `git push
origin main` → GitHub Actions typecheck → on green, `RENDER_DEPLOY_HOOK_URL` fires → Render
builds and deploys `style-assistant-api`; `dev` branch mirrors this against the dev Render service
and dev Supabase project first). Recommend using the `dev` pipeline as the de facto first-stage
canary for the backend itself, before promoting the same commit to `main`, since it already points
at an entirely separate Supabase project. Concrete checklist for the commit that ships:

1. **Confirm §T.9 step 3 (the Supabase migration) is applied to the target project first** —
   the backend-mediated bridge (`closet-outfit-sync.repository.ts`'s four legacy methods) doesn't
   depend on Supabase at all (Prisma/its own Postgres, `style_assistant_db`), so this ordering
   constraint is specifically about the **direct-Supabase** domains' reconciliation reads, not a
   real backend dependency — listed here for completeness of the full deployment sequence, not
   because the backend code itself would fail without it.
2. **Deploy this branch's backend changes**: the four bridged legacy repository methods
   (`upsertFavourite`/`deleteFavourite`/`upsertWeekPlanItem`/`deleteWeekPlanItem`, Phase 3B1); the
   already-existing version-aware endpoints (`POST /closet-outfit-sync/favourites/version-aware`,
   `PATCH .../:id/version-aware`, `DELETE .../:id/version-aware`, and the week-plan equivalents,
   Phase 1A); the reconciliation-read endpoints (`GET
   /closet-outfit-sync/favourites/for-reconciliation`, `GET .../week-plan/for-reconciliation`,
   Phase 2B1); `/health`'s new `syncCapabilities` field and `requestLogger`'s new version-telemetry
   fields (this checkpoint). All of these routes already require `requireAuth` — no auth
   middleware change is needed or was made.
3. **No new environment variables required** — this phase introduced no new secrets, no new
   config surface; the existing `DATABASE_URL`/Supabase/OpenAI env vars are unaffected.
4. **Run `scripts/smoke-build.mjs`** (Render's own build command, then boot + clean SIGTERM) as
   part of the deploy's own verification, exactly as it already does today — no change to this
   step, confirmed still green with this phase's code (§T.13).
5. Only after 1–4 are confirmed green: proceed to §T.3's Stage 3 (only if Stage 1/2's adoption bar
   is already met) or Stage 4 (client release), whichever this deployment is actually for.

### T.11 Production verification procedure (not run against production)

**Supabase — metadata**: `docs/sync-phase2a-reconciliation-spec.md` §S.10's script (RPC existence/
signature/security/grants, trigger attachment, policy shape, RLS enabled, direct DML still
permitted) — unchanged by this phase, still the correct metadata checklist.

**Supabase — behavioral** (needs a throwaway row + an authenticated test-user session, same
caveat §S.10 already documented for checks 8/9): legacy create; legacy update advances version
exactly once; legacy delete becomes a tombstone; repeated delete is idempotent; the new
reconciliation RPC sees the tombstone; a new-client CAS update against a stale `base_version`
(simulating "a legacy mutation happened after this client's last sync") correctly reports
`conflict`. All of these were already executed once against a disposable Postgres instance in
Phase 3B1 (§S.7) — re-running the identical matrix against the real production project (not a
disposable stand-in) before Stage 3 is the actual verification step; the disposable-Postgres run
proves the SQL is correct, not that production's actual current RLS/grant state matches what the
migration assumes.

**Backend**: `GET /health` (status 200, `syncCapabilities` both fields `true`); `node
scripts/smoke-build.mjs` (already part of the deploy pipeline); an authenticated
`POST /closet-outfit-sync/favourites/version-aware` round-trip against a real test user (proves
the version-aware path end-to-end against the deployed environment, not just a local test double);
same for `POST /closet-outfit-sync/week-plan/version-aware`; `GET
/closet-outfit-sync/favourites/for-reconciliation` and the week-plan equivalent, confirming a
tombstone created by the behavioral check above is visible through them.

None of this is executed as part of this checkpoint — it is the exact procedure for whoever
performs the eventual deployment.

### T.12 Canary rollout sequence

The distribution mechanism actually present in this repository is **EAS Build + TestFlight**
(`eas.json`, §T.1) — no evidence of a percentage-based production rollout mechanism (that's an App
Store Connect "phased release" feature, orthogonal to what's configured here, and not something
to assume exists without evidence). Recommend staging strictly within what's actually
discoverable:

1. **Internal — the `npm run deploy` single-device channel and/or an EAS `internal` distribution
   build** (`eas.json`'s `development`/`preview` profiles are both already `distribution:
   "internal"`) — the developer's own device(s) only.
   - *Go*: Stage 1 client (§T.3) builds, installs, and the Settings screen's version label and
     the new `X-App-Version`/`X-App-Build` headers are visibly present in backend logs for real
     requests from this device.
   - *Hold*: any crash on launch, any regression in existing ordinary read/write flows.
   - *Rollback*: don't distribute further; fix and rebuild.
2. **TestFlight — internal testers** (the small, known group with direct access, an existing EAS/
   TestFlight concept, not an invented one).
   - *Go*: §T.16's Stage 1 adoption/health criteria trending correctly among this cohort.
   - *Hold*: any protocol-shaped telemetry anomaly (§T.14) from this cohort.
   - *Rollback*: expire the TestFlight build; investigate before the next build.
3. **TestFlight — external testers** (a wider but still Apple-review-gated, opt-in group).
   - *Go*: same criteria as stage 2, sustained over a longer window with a larger, less
     controlled population.
   - *Hold*: same.
   - *Rollback*: same, plus consider whether the compatibility bridge itself (already deployed by
     this stage) needs to stay in place regardless — it's the safety net for whatever population
     hasn't updated yet.
4. **Full TestFlight rollout / App Store submission**, if and when this project actually pursues a
   public listing — not assumed here, since no repository evidence of a public App Store listing
   exists (§T.1); this step is named for completeness of the sequence, not because it's confirmed
   to be the project's actual next step.

### T.13 Validation (code changed this phase)

**Frontend**: `tsc --noEmit` clean; `eslint` clean (only pre-existing, unrelated warnings on
untouched lines); full suite 281/281 passed (29 files) — includes the four domains' reconciliation
suites, dual-write-regression suites, `all-domains-concurrency.test.ts`, the new
`app-version.test.ts`, `api-client-version-headers.test.ts`,
`closet-outfit-sync-reconciliation-reads.test.ts`, and the new abort-on-server-read-failure case
in `saved-outfits-reconciliation.test.ts`.

**Backend**: `tsc --noEmit` clean; full suite 164 passed, 1 pre-existing skip (18 files) —
includes the new `request-logger.test.ts` and the extended `app.smoke.test.ts` assertion on
`/health`'s `syncCapabilities`; `scripts/smoke-build.mjs` runtime smoke passed.

No capability-missing-at-the-RPC-layer test was needed beyond what §T.8 already added — that IS
the capability-missing test, exercised at the actual call site rather than via a separate
simulated-missing-capability harness.

### T.14 Telemetry thresholds, refined

Distinguishing protocol/infrastructure failures from legitimate product conflicts, per this
phase's own instruction not to mix them into one error rate:

**Protocol/infrastructure (strict — any sustained nonzero rate post-bridge-deployment is a hold
signal, §T.17)**:
- `operationalFailures` from `reconcileDomainRecords` (RPC missing, network error, unexpected
  shape) — now includes the new `skippedReason: 'server-fetch-failed'` runs as a first-class
  category (§T.8).
- `not_converged`/`redecide_required` reaching the runner's defensive branch (should never happen
  per the executor's own bounded-retry design — any occurrence is a bug signal, not noise).
- `inconsistent_state` outcomes.
- Auth failures on the version-aware/reconciliation-read routes specifically (a 401/403 rate
  distinguishable from ordinary unauthenticated traffic hitting `/closet/analyse`, which is
  already expected per the existing smoke test).

**Legitimate product conflicts (not rollout failures — track separately, expected to be nonzero
under normal use)**:
- `conflicts` from a genuine two-writer race (e.g. two devices reassigning the same week-plan day
  around the same time) — this is the decision engine doing its job correctly, per §G/§R.1's own
  framing (Case E/G/I are real conflicts, not bugs).
- `deferred` outcomes from unknown-ancestry-defer (Case K1) — expected during the compatibility
  era specifically because legacy writes exist with no metadata trail yet.

### T.15 Same-version drift expectation after the bridge

Before the Phase 3B1 bridge is deployed, `sameVersionDrift > 0` is *expected* whenever a legacy
client is still active (that's exactly the drift the bridge exists to close, and Case B/D's
content-aware detection, §R.1, is the safety net catching it in the meantime). **After** the
bridge is deployed (§T.9 step 3 live), every legacy mutation should advance `sync_version` by
construction — so a **sustained nonzero `sameVersionDrift` rate post-deployment is a strict,
strong signal** of exactly the failure modes §R.1/§S.8 already named (a missed write path, an
incompletely-applied migration, a direct/manual DB edit bypassing the trigger, a partial
rollback) and should gate further rollout (§T.17) rather than be treated as ordinary background
noise. Detection is not removed or weakened — §S.8 already confirmed this and it remains true
here.

### T.16 "Dirty remaining" — cause-distinguished, not a raw count

A raw dirty-record count conflates causes with very different rollout implications. Recommend
distinguishing using result categories `reconcileDomainRecords`'s `ReconciliationRunSummary`
already exposes, rather than adding new state to track:

- **`dirty_due_to_operational_failure`** — `dirtyRemaining` attributed to `operationalFailures`
  outcomes (including the new `server-fetch-failed` abort case, §T.8) or a thrown exception inside
  `reconcileOneRecord`. Rollout-health signal — should trend toward zero as server capability
  stabilizes.
- **`dirty_due_to_conflict`** — `dirtyRemaining` attributed to `conflict`/`deferred` outcomes.
  Product-normal, not a rollout-health signal on its own — correlate with §T.14's conflict-vs-
  infrastructure split before drawing any conclusion from it.
- **`dirty_due_to_deferred_legacy`** — specifically Case K1 (unknown-ancestry-defer, §R.1)
  outcomes — expected to shrink over the compatibility era as more records accumulate a version
  history, and a useful secondary signal (alongside §T.1's external adoption data) for how much
  truly-unmigrated legacy activity remains.

All three are derivable from the existing `reasonOf()`/outcome-kind classification already
computed inside `reconcileDomainRecords` (§ domain-reconciliation-runner.ts) — no new metadata
field is needed on disk; this is a log-aggregation/dashboard concern for whoever operates the
eventual telemetry pipeline, not a code change this checkpoint needed to make.

### T.17 Production go/no-go gates

| Gate | Criterion | Pass bar |
|---|---|---|
| Server capability | `/health`'s `syncCapabilities` reports both fields `true` on the target environment | PASS/FAIL, no partial credit |
| Compatibility bridge | §T.11's full behavioral matrix passes against the real target Supabase project (not just disposable Postgres) | PASS/FAIL |
| Runtime health | `scripts/smoke-build.mjs` and a live `/health` 200 against the deployed instance | PASS/FAIL |
| Auth/security | `requireAuth`-protected routes still reject unauthenticated traffic (401); RLS still enabled on both direct-Supabase tables (§T.11's metadata script) | PASS/FAIL |
| Client version/read compatibility | Stage 1 client (§T.3) confirmed adopted per §T.16's bar, *before* §T.9 step 3 is applied | PASS/FAIL |
| Rollback readiness | §T.18's procedure documented and understood for the specific stage about to be deployed | PASS/FAIL |
| Telemetry visibility | §T.14's protocol-failure and §T.16's dirty-cause categories are actually queryable in whatever log aggregation is in place | PASS/FAIL |

Per this phase's own instruction: correctness/security gates do not accept "mostly green" —
every row above is binary.

### T.18 Rollback by deployment stage

- **Supabase migration deployed, backend not yet deployed**: direct-Supabase domains are already
  bridged (legacy writes advance version, legacy deletes tombstone); backend-mediated domains
  still on old semantics. To roll back: run the migration file's own documented rollback SQL
  (drop the two new triggers per table, the three trigger functions, the two reconciliation RPCs,
  the four policies per table, recreate one broad `FOR ALL` policy per table). Rows already
  soft-deleted or version-advanced while the bridge was live stay that way — this is a code/schema
  rollback, not a data rollback.
- **Supabase + backend deployed, client not released**: both server-side paths bridged, but no
  client depends on them yet (the currently-installed population is still the pre-Phase-2B1
  binary from §T.1). Rollback is the same Supabase SQL above plus an ordinary backend code
  revert (git revert the repository change) — same caveat, rows already touched under the bridge
  keep their new state.
- **Canary client released**: stop distributing further immediately (halt at whatever TestFlight
  stage §T.12 is at) rather than reaching for a database rollback first — per this phase's own
  instruction, prefer stopping rollout over destructive schema rollback unless genuinely
  necessary. Only fall back to the schema/backend rollback above if the canary cohort itself is
  actively experiencing data loss or corruption, not merely an elevated (but non-destructive)
  error rate.
- **Partial percentage rollout**: same as canary — halt further distribution first; the bridge
  stays live (it's strictly safer for whatever population is already on Stage 1+ than reverting
  it would be, since reverting reopens the exact same-version-drift hole for anyone still on a
  legacy binary).
- **Full client rollout**: same principle — a schema/backend rollback at this stage actively
  reintroduces the coexistence risk for the entire installed population, not just a canary
  cohort; only do this if the alternative (leaving the bridge live) is demonstrably worse for a
  specific, identified incident.

### T.19 Safety changes that must survive any sync rollback

Regardless of what happens to the sync rollout itself, these do not get bundled into a rollback
and should remain permanently:

- JWT verification (`requireAuth` middleware) — unrelated to sync, a baseline security control.
- CORS hardening — same.
- Existing error logging / Crashlytics wiring (`lib/crashlytics.ts`, backend's `logger`) —
  observability infrastructure, not sync-specific.
- Phase 3B's same-version drift protection (Case B/D content-awareness, §R.1) — this is client-
  side defense-in-depth that remains correct and valuable **independent of** whether the
  server-side bridge (Phase 3B1) is deployed or rolled back; removing it would reopen a real
  correctness hole for no benefit.
- Ordinary tombstone filtering (`fetchSavedOutfitsFromSupabase`/`fetchWeekPlanFromSupabase`'s
  `.is('deleted_at', null)`, Phase 2B1) — correct and necessary regardless of bridge status.
- The legacy-ownership fixes in `closet-outfit-sync.repository.ts` (`upsertFavourite`'s
  ownership-scoped update-before-create, confirmed safe for `upsertWeekPlanItem` via its compound
  key) — these close a real cross-user data-corruption bug, unrelated to the version/tombstone
  bridge semantics layered on top of them in Phase 3B1.
- This phase's own reactive fetch-failure safety net (§T.8) — independent of whether the bridge
  itself is ever deployed, silently treating a failed read as "zero records" is wrong regardless.

### T.20 Phase 3C entry criteria (revised)

Building on §R.20–§R.22's planning (still planning-only, nothing executed) with this phase's
concrete gates:

- Server bridge (§T.9) deployed and stable — §T.17's gates green, sustained.
- Fully version-aware client (Stage 4, §T.3) released and stable.
- **Client adoption known** — not assumed: the external check in §T.1/§T.6 (App Store Connect/
  TestFlight adoption, Firebase Analytics version breakdown) actually consulted and showing the
  legacy (pre-Stage-1) population at or below whatever threshold is set operationally (§T.21 — no
  fabricated number is supplied here).
- Legacy backend route traffic (the plain, non-`version-aware` `closet-outfit-sync` endpoints,
  §T.10) sufficiently low or zero, per the version telemetry this checkpoint added (§T.6) —
  now actually measurable, where before this phase it was not.
- Direct legacy client population sufficiently low/zero, per the external check above (backend
  telemetry cannot measure this population directly, §T.6's limitation).
- `sameVersionDrift` effectively zero, sustained, post-bridge (§T.15) — a nonzero rate at this
  point is a reason to *delay* Phase 3C, not proceed.
- No open protocol/infrastructure telemetry anomalies (§T.14).
- Rollback tested and documented (§T.18) — done, this checkpoint.

Per this phase's own instruction: do not schedule Phase 3C merely because a fixed number of weeks
elapsed — time is supportive evidence for adoption trending in the right direction, not the gate
itself.

### T.21 Observation window and adoption criteria, revised

Phase 3B proposed a flat 4–6 weeks and flagged the telemetry gap itself (§R.18/§R.19). Replacing
the pure time-based figure with the structure this phase's instructions ask for:

```
minimum observation period + minimum adoption criteria + health criteria
```

- **Minimum observation period**: retain §R.18's 4–6 weeks as a *floor*, not a target — it is
  still a reasonable minimum dwell time for a TestFlight cohort to actually exercise the app
  across its real usage patterns (a save, a delete, a re-save of a deleted item), but per this
  phase's instruction, it does not by itself satisfy the gate.
- **Minimum adoption criteria**: **left as an operational value to obtain before enforcement** —
  this session has no access to App Store Connect/Firebase Analytics' actual current adoption
  numbers (§T.1/§T.6), and fabricating a specific percentage here would be exactly the "invented
  data" this phase's instructions prohibit. Once that data is available, the natural criterion is
  "≥ some agreed percentage of measured active sessions in the observation window report
  `X-App-Version` ≥ the Stage-1 version" (directly measurable via §T.6's backend telemetry for the
  backend-mediated domains, and via the external check for the direct-Supabase population).
- **Health criteria**: §T.17's gates, sustained (not merely passing once) across the whole
  observation period — a single green verification run is a deployment gate, not an adoption
  gate.

Only when all three hold together does §T.9 step 3 / §T.3's Stage 3 proceed.

### T.22 Files changed (this phase)

- `lib/app-version.ts` (new)
- `lib/api/api-client.ts` (attaches `X-App-Version`/`X-App-Build`)
- `app/(app)/useSettings.ts` (re-exports `APP_VERSION` instead of its own `Constants` read)
- `lib/supabase-data.ts` (`fetchSavedOutfitsForReconciliation`/`fetchWeekPlanForReconciliation`
  throw on failure instead of resolving to `[]`)
- `lib/closet-outfit-sync.ts` (same contract change for the two backend-mediated reconciliation
  reads)
- `lib/domain-reconciliation-runner.ts` (`reconcileDomainRecords` aborts cleanly with
  `skippedReason: 'server-fetch-failed'` on a fetch-level throw)
- `backend/src/middleware/request-logger.ts` (sanitized `appVersion`/`appBuild` log fields)
- `backend/src/modules/health/health.routes.ts` (`syncCapabilities` field)
- `lib/__tests__/app-version.test.ts` (new)
- `lib/__tests__/api-client-version-headers.test.ts` (new)
- `lib/__tests__/closet-outfit-sync-reconciliation-reads.test.ts` (new)
- `lib/__tests__/supabase-data-reconciliation-reads.test.ts` (updated: throw-on-error assertions)
- `lib/__tests__/saved-outfits-reconciliation.test.ts` (new describe block: abort-on-fetch-failure)
- `backend/src/middleware/__tests__/request-logger.test.ts` (new)
- `backend/src/__tests__/app.smoke.test.ts` (extended: asserts `syncCapabilities`)
- `docs/sync-phase2a-reconciliation-spec.md` (this section)

### T.23 Remaining blocker before first real deployment

The unresolved external check (§T.1/§T.6): actually consulting App Store Connect/TestFlight
adoption data and/or the Firebase Analytics console for the production bundle id's version
distribution. Nothing in this repository can substitute for that check, and per §T.2, Path A
cannot be selected without it. This is an **operational** action item, not a code or documentation
gap — no further local work closes it.

### T.24 Recommended next operational action

Consult the external adoption signal named in §T.23. If it confirms the legacy population is
already at or near zero (consistent with, though not proven by, the 90-day TestFlight-expiration
reasoning in §T.1), Path A may become selectable and Stage 1/2 of §T.3 could be skipped in favor
of going straight to Stage 3 — but that re-classification requires the actual external data, not
a re-reading of this repository. If it shows a real remaining population, proceed with Stage 1
(§T.3) as planned. Either way, no further code work is required before that operational check —
this checkpoint's code changes (telemetry, capability signal, fetch-failure safety net) are ready
for either path.
