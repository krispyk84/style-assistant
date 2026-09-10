-- Phase 3B1 of the local<->cloud synchronization redesign — legacy
-- coexistence server-side compatibility bridge, for saved_outfits and
-- week_plan (the two direct-Supabase domains). Additive, applied AFTER
-- 20260907010000_phase1a_version_aware_rpcs.sql — that file is left
-- historically intact and unmodified; every change here is a NEW object
-- (trigger function, trigger, RPC) or an explicit, documented replacement
-- of the two tables' RLS policy set. Applied manually via the Supabase SQL
-- Editor, same mechanism/URL documented in Phase 1A's own migration file —
-- there is still no automated pipeline that reaches this database.
--
-- ── Why this phase exists ────────────────────────────────────────────────
-- Phase 3B's audit (docs/sync-phase2a-reconciliation-spec.md §R) found that
-- a legacy (currently-installed) client's direct-table upsert/delete never
-- touches sync_version/deleted_at at all — confirmed by reading
-- lib/supabase-data.ts's upsertSavedOutfitToSupabase/upsertWeekPlanItemToSupabase
-- (their payload objects list only content columns) and
-- deleteSavedOutfitFromSupabase/deleteWeekPlanItemFromSupabase (a bare
-- physical DELETE). A new version-aware client's decision engine now
-- detects this drift client-side (§R.1's Case B/D fix) but cannot FULLY
-- protect a dirty local edit against it — only a server-side guarantee
-- that every mutation participates in the same version/tombstone lineage
-- closes that gap completely. This migration is that guarantee.
--
-- ── What this migration does, in one sentence per concern ───────────────
-- 1. A shared trigger makes any UPDATE that does not itself explicitly
--    advance sync_version get one bumped automatically, and reactivates a
--    tombstoned row it touches (a legacy upsert's whole purpose is "this
--    record is active with this content").
-- 2. A per-table trigger makes a physical DELETE against an active row
--    become a soft tombstone instead (version bumped once), and a
--    repeated DELETE against an already-tombstoned row a true no-op (no
--    version churn, no error to the caller either way).
-- 3. The two tables' RLS policy set is reconstructed from whatever
--    currently exists (this repo has no on-file record of the original
--    policy — it predates this project, confirmed absent from git history)
--    into four explicit, per-command policies, all ownership-only
--    (auth.uid() = user_id) — INCLUDING SELECT, deliberately NOT restricted
--    to deleted_at IS NULL. An earlier version of this migration DID
--    restrict SELECT that way; disposable-Postgres testing proved it breaks
--    legacy tombstone reactivation outright (PostgreSQL ties UPDATE/upsert
--    row-targeting visibility to the table's SELECT policy, so a
--    deleted_at-restricted SELECT policy makes a tombstoned row invisible
--    to the legacy client's own reactivating upsert, not just to reads —
--    see Part 3's inline comment for the full proof). Ordinary-read
--    tombstone-hiding is instead already handled in application code
--    (lib/supabase-data.ts's fetchSavedOutfitsFromSupabase/
--    fetchWeekPlanFromSupabase both add `.is('deleted_at', null)`, Phase
--    2B1) for every client build from Phase 2B1 onward; the residual gap
--    for a build that predates that filter (the currently-live production
--    app, since none of this has shipped yet) is accepted and closed by
--    deployment order, not by RLS — see the Phase 3B1 spec section.
-- 4. Two new SECURITY DEFINER RPCs give the new client's reconciliation
--    engine an explicit, dedicated read surface (active AND tombstoned
--    rows, schema-locked output) — kept for contract-stability and
--    forward-compatibility even though, per Part 3 above, a plain table
--    read would technically already return the same rows to their owner.
--
-- ── Prerequisite ──────────────────────────────────────────────────────────
-- Requires 20260907000000_add_sync_version_deleted_at.sql and
-- 20260907010000_phase1a_version_aware_rpcs.sql already applied (adds the
-- columns; the six CAS RPCs already correctly advance sync_version/manage
-- deleted_at themselves, so this migration's triggers must never
-- double-increment their writes — verified in this session's disposable-
-- Postgres testing, not merely asserted; see this phase's report).
--
-- ── Rollback (§23) ────────────────────────────────────────────────────────
-- All new objects can be dropped without touching any row:
--   DROP TRIGGER IF EXISTS trg_enforce_version_advance ON public.saved_outfits;
--   DROP TRIGGER IF EXISTS trg_enforce_version_advance ON public.week_plan;
--   DROP TRIGGER IF EXISTS trg_redirect_legacy_delete ON public.saved_outfits;
--   DROP TRIGGER IF EXISTS trg_redirect_legacy_delete ON public.week_plan;
--   DROP FUNCTION IF EXISTS public.enforce_legacy_write_protocol();
--   DROP FUNCTION IF EXISTS public.redirect_legacy_delete_saved_outfits();
--   DROP FUNCTION IF EXISTS public.redirect_legacy_delete_week_plan();
--   DROP FUNCTION IF EXISTS public.get_saved_outfits_reconciliation_state();
--   DROP FUNCTION IF EXISTS public.get_week_plan_reconciliation_state();
--   DROP POLICY IF EXISTS saved_outfits_select_own ON public.saved_outfits;
--   DROP POLICY IF EXISTS saved_outfits_insert_own ON public.saved_outfits;
--   DROP POLICY IF EXISTS saved_outfits_update_own ON public.saved_outfits;
--   DROP POLICY IF EXISTS saved_outfits_delete_own ON public.saved_outfits;
--   DROP POLICY IF EXISTS week_plan_select_own ON public.week_plan;
--   DROP POLICY IF EXISTS week_plan_insert_own ON public.week_plan;
--   DROP POLICY IF EXISTS week_plan_update_own ON public.week_plan;
--   DROP POLICY IF EXISTS week_plan_delete_own ON public.week_plan;
--   -- Then re-create a single broad "auth.uid() = user_id" FOR ALL policy
--   -- per table to restore the pre-this-migration RLS shape.
-- IMPORTANT: dropping these objects restores the OLD unsafe behavior
-- (legacy writes silently drift again, tombstones become visible to
-- old-client reads again) — it does NOT undo any tombstone/version state
-- already produced while the bridge was live. Rows already soft-deleted or
-- version-advanced by this bridge stay that way; only future writes are
-- affected by the rollback. Rollback capability does not mean rollback is
-- risk-free — see docs/sync-phase2a-reconciliation-spec.md §R's rollback
-- section for the full analysis. This rollback SQL is documented here but
-- NOT executed as part of this migration.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Shared version-advance + reactivate-on-write trigger
-- ═══════════════════════════════════════════════════════════════════════
-- Fires on every UPDATE to either table. If the UPDATE statement itself
-- already explicitly set sync_version (every one of Phase 1A's six RPCs
-- does, always to OLD value + 1 — never a caller-supplied absolute value),
-- NEW.sync_version already differs from OLD.sync_version by the time this
-- trigger runs, so it correctly does nothing (no double-increment). If the
-- UPDATE did NOT touch sync_version at all (the only other way to reach
-- this table via SQL: a legacy client's upsert conflict-update, which lists
-- only content columns in its SET clause — confirmed by reading
-- lib/supabase-data.ts), NEW.sync_version equals OLD.sync_version
-- automatically (Postgres leaves untouched columns unchanged), and this is
-- the ONLY reliable, generic signal available to detect "this was a legacy
-- write" without hardcoding a content-column list that could drift out of
-- sync with the schema. Deliberately does not attempt to distinguish
-- "content actually changed" from "content resubmitted unchanged" within a
-- legacy write — a no-op legacy resave consuming one version number is
-- harmless (the new client's next reconciliation pass adopts identical
-- content, a wasted but correct no-op cycle), and no real code path in this
-- repo ever explicitly reassigns sync_version to its own current value (the
-- only place that reassigns it is these six RPCs, always as `+ 1`), so the
-- "synchronization field writing itself back unchanged" edge case the
-- design review raised does not actually arise from any traced call site.
-- Runs as SECURITY INVOKER (the default — no elevation here). This function
-- only ever assigns NEW.sync_version/NEW.deleted_at directly on the in-flight
-- row; it never issues its own nested query, so it never itself confronts
-- RLS. (An earlier version of Part 3's SELECT policy restricted ordinary
-- reads to `deleted_at IS NULL`, which — via a DIFFERENT mechanism, proven
-- and documented at Part 3 — broke legacy upsert-reactivation; that finding
-- is about the RLS policy shape, not about this trigger function, and Part 3
-- reverts to an ownership-only SELECT policy specifically so no function in
-- this migration needs privilege elevation to reactivate a tombstone.)
CREATE OR REPLACE FUNCTION public.enforce_legacy_write_protocol()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.sync_version IS NOT DISTINCT FROM OLD.sync_version THEN
    NEW.sync_version := OLD.sync_version + 1;
    -- A legacy upsert's whole purpose is "this record is active with this
    -- content" — reactivate consistently with how the version-aware update
    -- RPCs already treat a version-matched update against a tombstone
    -- (both already unconditionally clear deleted_at on apply).
    NEW.deleted_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_version_advance
  BEFORE UPDATE ON public.saved_outfits
  FOR EACH ROW EXECUTE FUNCTION public.enforce_legacy_write_protocol();

CREATE TRIGGER trg_enforce_version_advance
  BEFORE UPDATE ON public.week_plan
  FOR EACH ROW EXECUTE FUNCTION public.enforce_legacy_write_protocol();

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Physical-DELETE-to-tombstone redirect (one function per table — the
--    two tables' identity/WHERE shape differs: saved_outfits by id alone,
--    week_plan by the (user_id, day_key) compound key — matching Phase 1A's
--    own convention of separate, explicit per-table functions rather than
--    one function branching dynamically on TG_TABLE_NAME).
-- ═══════════════════════════════════════════════════════════════════════
-- A BEFORE DELETE trigger that returns NULL cancels the physical delete for
-- that row (a standard, well-established Postgres pattern) — the row is
-- already lock-held by the in-progress DELETE statement, so this trigger's
-- own UPDATE on the same row, in the same transaction, is safe (no self-
-- deadlock). Runs as SECURITY INVOKER (the default): its own nested UPDATE
-- sets deleted_at to a non-null value, which — with an EARLIER, since-
-- reverted version of Part 3's SELECT policy restricted to
-- `deleted_at IS NULL` — failed RLS's implicit visibility check on the
-- resulting row (proven empirically; see Part 3's comment for the full
-- explanation and why the fix is the SELECT policy shape, not privilege
-- elevation here). With Part 3's ownership-only SELECT policy, this nested
-- UPDATE is a perfectly ordinary RLS-compliant statement — OLD is already
-- scoped to whatever row the ownership-scoped DELETE policy allowed the
-- statement to target in the first place, so no elevation is needed or
-- used. The legacy client's own deleteSavedOutfitFromSupabase/
-- deleteWeekPlanItemFromSupabase only check `{ error }`, never a row count
-- — since this trigger never raises an error, the old client perceives an
-- ordinary successful delete, matching what it already believes happened
-- locally. Idempotent by construction: if OLD.deleted_at is already set,
-- the trigger does nothing at all (no UPDATE issued, so no version churn)
-- before still cancelling the physical delete — a repeated legacy delete
-- of an already-tombstoned identity costs nothing.
CREATE OR REPLACE FUNCTION public.redirect_legacy_delete_saved_outfits()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.deleted_at IS NULL THEN
    UPDATE public.saved_outfits
       SET deleted_at = now(), sync_version = sync_version + 1
     WHERE id = OLD.id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_redirect_legacy_delete
  BEFORE DELETE ON public.saved_outfits
  FOR EACH ROW EXECUTE FUNCTION public.redirect_legacy_delete_saved_outfits();

CREATE OR REPLACE FUNCTION public.redirect_legacy_delete_week_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.deleted_at IS NULL THEN
    UPDATE public.week_plan
       SET deleted_at = now(), sync_version = sync_version + 1
     WHERE user_id = OLD.user_id AND day_key = OLD.day_key;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_redirect_legacy_delete
  BEFORE DELETE ON public.week_plan
  FOR EACH ROW EXECUTE FUNCTION public.redirect_legacy_delete_week_plan();

-- ═══════════════════════════════════════════════════════════════════════
-- 3. RLS policy reconstruction — split by command, all four ownership-only.
-- ═══════════════════════════════════════════════════════════════════════
-- This repo has no on-file record of these two tables' original policy
-- definitions (they predate this project — confirmed by their absence from
-- supabase/migrations/ entirely; Phase 1A's own migration comment
-- documents only that a policy shaped `auth.uid() = user_id` was confirmed
-- present via pg_policies at the time, not its exact name or whether it
-- was a single FOR ALL policy or already split). Rather than guessing a
-- name to DROP POLICY by, this block discovers and drops every existing
-- policy on both tables dynamically, then creates the four explicit
-- replacements below. This is deliberately a full reconstruction, not an
-- incremental edit, specifically because guessing wrong about the existing
-- policy's exact predicate (Part 5's warning) risks silently blocking a
-- legacy UPDATE/DELETE against a tombstoned row — verified against a
-- disposable Postgres instance simulating exactly the single-broad-policy
-- starting shape Phase 1A's own comment describes.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'saved_outfits'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.saved_outfits', pol.policyname);
  END LOOP;

  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'week_plan'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.week_plan', pol.policyname);
  END LOOP;
END $$;

-- saved_outfits: ordinary SELECT stays ownership-only, matching the
-- ORIGINAL (pre-migration) predicate exactly — deliberately NOT restricted
-- to deleted_at IS NULL, despite that being this migration's original
-- design (see the abandoned attempt this comment documents below). Proven
-- against a real disposable Postgres instance: PostgreSQL ties UPDATE/
-- upsert row-TARGETING visibility to the table's SELECT policy — for both
-- a plain `UPDATE ... WHERE id = X` and an `INSERT ... ON CONFLICT (id) DO
-- UPDATE`, Postgres ANDs the applicable SELECT policy's USING clause into
-- the set of rows the command can even see as an update target, REGARDLESS
-- of what the UPDATE-specific policy's own USING/WITH CHECK say. A
-- `deleted_at IS NULL` SELECT policy therefore makes every tombstoned row
-- invisible not just to reads but to the legacy client's own upsert-based
-- reactivation (§8/§R): the observed failure mode was `ON CONFLICT DO
-- UPDATE` raising "new row violates row-level security policy (USING
-- expression)" outright (Postgres can see the conflicting id via the unique
-- index, which isn't RLS-gated, but then can't satisfy RLS to apply the
-- UPDATE arm to it) — a hard error on exactly the legacy call
-- (upsertSavedOutfitToSupabase) that is supposed to silently resurrect a
-- previously-deleted-then-recreated id. Verified both ways: with the
-- restrictive predicate removed, the identical upsert succeeds and
-- correctly reactivates (deleted_at cleared, sync_version advances by
-- exactly one); with it present — or with no SELECT policy defined at all —
-- the same upsert fails every time. This is a structural PostgreSQL RLS
-- property (SELECT-policy visibility gates UPDATE/upsert targeting; no
-- combination of split, command-scoped policies can decouple "visible for
-- an ordinary read" from "visible for a mutation's WHERE/ON CONFLICT match"
-- on the same table for the same role), not a bug in this migration's
-- trigger logic — legacy mutation compatibility (Part 2's invariant) is
-- treated as the higher-severity requirement over ordinary-read tombstone-
-- hiding at the RLS layer, since a broken reactivation is data-loss-shaped
-- (a legacy user's save silently or loudly fails) while a stale tombstone
-- reappearing in a bare legacy read is a cosmetic, self-correcting-on-next-
-- sync display glitch.
--
-- Ordinary-read tombstone-hiding for THIS repo's own client code is instead
-- already handled one layer up, in application code, unconditionally: both
-- lib/supabase-data.ts's fetchSavedOutfitsFromSupabase and
-- fetchWeekPlanFromSupabase add an explicit `.is('deleted_at', null)`
-- query-level filter (Phase 2B1) — true for every build of this app from
-- Phase 2B1 onward, independent of any RLS predicate. The only client
-- population this leaves exposed to a tombstone reappearing in an ordinary
-- read is a build that predates Phase 2B1's filter entirely — which, since
-- none of this sync work (Phase 0 through this checkpoint) has ever been
-- pushed or deployed, describes the CURRENTLY LIVE production app itself.
-- This residual gap is the same one Phase 3B's own review already
-- identified and explicitly deferred (§R's "known, lower-severity gap");
-- this checkpoint adds the concrete proof that closing it at the RLS layer
-- is not merely undone-but-possible — it is actively incompatible with
-- legacy reactivation, so the correct closure is a deployment-order
-- guarantee (ship this same release, which is the release that first makes
-- any tombstone possible at all, to every installed client before any
-- tombstone can be created) rather than a database predicate. See the
-- Phase 3B1 spec section for the full writeup and the production
-- deployment-order prerequisite this implies.
CREATE POLICY saved_outfits_select_own ON public.saved_outfits
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE stay ownership-only — deliberately NOT restricted
-- to deleted_at IS NULL. An UPDATE must still be able to target and
-- reactivate a tombstoned row (the reactivation case, §8/§R above); a
-- DELETE must still be able to target an already-tombstoned row for the
-- idempotent-repeated-delete guarantee (§10) — the ownership-only USING
-- clause lets the statement reach the row at all, and
-- redirect_legacy_delete_saved_outfits's own OLD.deleted_at check (not
-- RLS) is what makes the repeat a no-op.
CREATE POLICY saved_outfits_insert_own ON public.saved_outfits
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY saved_outfits_update_own ON public.saved_outfits
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY saved_outfits_delete_own ON public.saved_outfits
  FOR DELETE
  USING (auth.uid() = user_id);

-- week_plan: identical shape and identical reasoning as saved_outfits above
-- (ownership-only SELECT, deliberately not deleted_at-restricted — proven
-- against the disposable instance the same way, same failure mode on
-- legacy reactivation with the restrictive predicate in place).
CREATE POLICY week_plan_select_own ON public.week_plan
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY week_plan_insert_own ON public.week_plan
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY week_plan_update_own ON public.week_plan
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY week_plan_delete_own ON public.week_plan
  FOR DELETE
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 4. Reconciliation-read RPCs — an explicit, dedicated read surface for the
--    new client's reconciliation engine, distinct from the ordinary-read
--    path above.
-- ═══════════════════════════════════════════════════════════════════════
-- Given Part 3's SELECT policy is ownership-only (not deleted_at-
-- restricted, per the finding documented there), a plain
-- `.from(table).select('*')` would technically already return tombstoned
-- rows to their own owner — these RPCs are therefore NOT the only path that
-- can see a tombstone, unlike this migration's original design assumed.
-- They are kept anyway, as SECURITY DEFINER, for reasons independent of
-- that original visibility argument: (1) an explicit, schema-locked output
-- contract (out_* columns) that doesn't silently change shape if the table
-- gains columns later; (2) decoupling the new client's reconciliation path
-- from whatever the ordinary SELECT policy happens to be today, so a FUTURE
-- tightening of ordinary-read policy (e.g. a Phase 3C that finally can
-- restrict it now that no legacy upsert-reactivation depends on it — see
-- Part 3's note that this requires retiring the legacy path first) does not
-- also have to remember to carry the reconciliation engine along with it;
-- (3) consistency with Phase 1A's six CAS RPCs, which already use this
-- exact SECURITY DEFINER + explicit-ownership-WHERE shape. Cross-user
-- isolation is verified directly against a disposable Postgres instance
-- below, not assumed by analogy to Phase 1A.
CREATE OR REPLACE FUNCTION public.get_saved_outfits_reconciliation_state()
RETURNS TABLE (
  out_id text,
  out_request_id text,
  out_saved_at timestamptz,
  out_input jsonb,
  out_recommendation jsonb,
  out_sync_version integer,
  out_deleted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
    SELECT s.id, s.request_id, s.saved_at, s.input, s.recommendation, s.sync_version, s.deleted_at
    FROM public.saved_outfits s
    WHERE s.user_id = v_caller;
END;
$$;

ALTER FUNCTION public.get_saved_outfits_reconciliation_state() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_saved_outfits_reconciliation_state() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_saved_outfits_reconciliation_state() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_saved_outfits_reconciliation_state() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_week_plan_reconciliation_state()
RETURNS TABLE (
  out_day_key text,
  out_day_label text,
  out_request_id text,
  out_assigned_at timestamptz,
  out_input jsonb,
  out_recommendation jsonb,
  out_sync_version integer,
  out_deleted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
    SELECT w.day_key, w.day_label, w.request_id, w.assigned_at, w.input, w.recommendation, w.sync_version, w.deleted_at
    FROM public.week_plan w
    WHERE w.user_id = v_caller;
END;
$$;

ALTER FUNCTION public.get_week_plan_reconciliation_state() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_week_plan_reconciliation_state() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_week_plan_reconciliation_state() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_week_plan_reconciliation_state() TO authenticated;
