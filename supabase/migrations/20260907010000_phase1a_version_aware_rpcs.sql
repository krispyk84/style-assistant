-- Phase 1A of the local<->cloud synchronization redesign.
--
-- Phase 1B.1 CORRECTION (this session): create_saved_outfit/
-- update_saved_outfit/delete_saved_outfit originally declared their id
-- parameter/return column as `uuid`. That was wrong — traced end-to-end
-- this session: the frontend generates requestId as `request-<timestamp>`
-- (lib/look-mock-data.ts's createMockRequestId, used unconditionally, not
-- just in mock mode — see components/forms/createLookRequest-mappers.ts),
-- optionally suffixed `-v2`/`-v3` for same-tier multi-look variants, and
-- lib/saved-outfits-storage.ts's buildSavedOutfitId composes the actual
-- row id as `${requestId}:${tier}` (optionally `:g${generation}`) — e.g.
-- `request-1788829952675:business`. None of that is valid UUID syntax, and
-- this table demonstrably accepts these ids in production today (saved
-- outfits is a long-working, exercised feature) — a `uuid`-typed column
-- would reject every single one of these inserts, so the column can only
-- be `text`. Corrected below (`p_id text`, `out_id text`, and the six
-- ALTER/REVOKE/GRANT signatures that reference them) to match. This is a
-- parameter/return-type fix only — no ALTER TABLE is needed, since this
-- file never created saved_outfits' columns in the first place (that
-- table predates this project); it only fixes these functions to match
-- the column type saved_outfits.id already actually has.
--
-- This migration has never been applied anywhere outside this session's
-- own disposable/throwaway local Postgres test instances (each torn down
-- immediately after verification) — never against the real Supabase
-- project. So this is a correction in place, not a rewrite of deployed
-- history; there is nothing "deployed" yet for this file. Re-verified
-- end-to-end against a fresh disposable Postgres instance with a real
-- representative id (`request-1788829952675:business`) after this fix —
-- see this session's Phase 1B.1 report.
--
-- Before applying this file for the first time, confirm the actual column
-- type directly rather than trusting this comment alone:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'saved_outfits' AND column_name = 'id';
-- Expect data_type = 'text' (or 'character varying'). If it is genuinely
-- 'uuid', STOP — that would mean every saved-outfit id in production is
-- already a valid UUID and this whole correction's premise is wrong;
-- re-derive from that finding rather than applying this file as-is.
--
-- Adds NEW version-aware mutation capability for saved_outfits/week_plan.
-- Deliberately additive: the existing direct-table upsert/delete path in
-- lib/supabase-data.ts is untouched and keeps working exactly as today.
-- Nothing calls these functions yet — they exist so a later phase (the
-- local outbox + reconciliation engine) has something safe to call, and so
-- the enforcement cutover (Phase 3C) has a real, tested boundary to switch
-- traffic onto. See CLAUDE.md / this session's design notes for the full
-- phase plan. TEMPORARY-COMPAT TAG: none of this file is temporary — it is
-- the new permanent path. The temporary thing is the OLD direct-table
-- write path in lib/supabase-data.ts, which Phase 3C must retire once the
-- frontend is switched over; that removal is out of scope here.
--
-- ── Deployment mechanism (Part 5 of this session's corrections) ────────
--
-- This file lives under supabase/migrations/, applied MANUALLY via the
-- Supabase dashboard SQL Editor:
--   https://supabase.com/dashboard/project/aiosmeylkwwyglxiykxv/sql/new
-- NOT via `prisma migrate deploy` (which only ever touches this repo's
-- OTHER, wholly separate database — see below). This was checked again
-- this session, not just assumed:
--   - backend/prisma/schema.prisma's datasource is `env("DATABASE_URL")`,
--     a single generic Postgres connection with no Supabase-specific
--     wiring.
--   - In production that env var points at a Render-hosted Postgres
--     instance (style_assistant_db, host dpg-d6rk7qchg0os73emutc0-a) —
--     provably NOT the Supabase project's own database, because Phase 0's
--     first attempt at reaching saved_outfits/week_plan through this exact
--     Prisma connection failed in production with
--     `P3018 ... relation "saved_outfits" does not exist`. That failure IS
--     the proof: the role and connection `prisma migrate deploy` uses have
--     no path to this database at all, safe or otherwise — it isn't a
--     permissions gap on an otherwise-shared database, it is a genuinely
--     different database on a genuinely different host.
--   - This repo has no `supabase/config.toml` project link and no
--     Supabase-flavored connection string in any local env file (checked
--     this session — no backend/.env, no root .env, nothing matching
--     SUPABASE*DB*/POSTGRES*SUPABASE* anywhere).
--   - Net effect: there is no automated, in-repo path to this database at
--     all right now, in either direction. Manual application is the only
--     option until a Supabase CLI project link is set up (a real,
--     worthwhile future improvement — tracked as a recommendation, not
--     done here, since it's out of this phase's scope).
--
-- Given that, this is NOT a duplicate-mechanism situation: Phase 0's two
-- migration files (backend/prisma/migrations/... for style_assistant_db,
-- supabase/migrations/... for this database) target two different real
-- databases, each through the only mechanism that can reach it. There is
-- exactly one authoritative copy of this phase's RPC SQL, here.
--
-- Process until a CLI link exists:
--   1. Copy this file's contents into the SQL Editor at the URL above.
--   2. Run it. `CREATE OR REPLACE FUNCTION` makes re-running safe if
--      pasted twice by mistake; the REVOKE/GRANT/ALTER OWNER statements
--      below are also idempotent (re-running them re-asserts the same
--      end state, not an incremental change).
--   3. Verify with:
--        SELECT proname, proowner::regrole, prosecdef
--        FROM pg_proc
--        WHERE proname IN ('create_saved_outfit','update_saved_outfit',
--          'delete_saved_outfit','create_week_plan_item',
--          'update_week_plan_item','delete_week_plan_item');
--      Expect prosecdef = true (SECURITY DEFINER) and proowner = a
--      trusted admin role (e.g. postgres), never authenticated/anon.
--      Confirm grants with:
--        SELECT routine_name, grantee, privilege_type
--        FROM information_schema.routine_privileges
--        WHERE routine_name IN (...same six...);
--      Expect exactly one grantee per function: authenticated.
--   4. There is no automated tracking table for this database (unlike
--      Prisma's _prisma_migrations) — the only record of "has this run in
--      production" is (a) this file's presence in git history, cross-
--      checked against (b) actually running the verification query above
--      against the live database. Another developer/machine must run that
--      query to know whether this has already been applied; there is
--      currently no better mechanism than that, and it should be treated
--      as a known gap, not a solved problem.
--   5. Rollback recipe (additive/idempotent — nothing here mutates or
--      deletes existing data, so "rollback" only means removing the new
--      capability, not undoing any write):
--        DROP FUNCTION IF EXISTS public.create_saved_outfit(text, text, timestamptz, jsonb, jsonb);
--        DROP FUNCTION IF EXISTS public.update_saved_outfit(text, integer, text, timestamptz, jsonb, jsonb);
--        DROP FUNCTION IF EXISTS public.delete_saved_outfit(text, integer);
--        DROP FUNCTION IF EXISTS public.create_week_plan_item(text, text, text, timestamptz, jsonb, jsonb);
--        DROP FUNCTION IF EXISTS public.update_week_plan_item(text, integer, text, text, timestamptz, jsonb, jsonb);
--        DROP FUNCTION IF EXISTS public.delete_week_plan_item(text, integer);
--
-- ── Security model: SECURITY DEFINER (revised from Phase 1A's original
--    SECURITY INVOKER draft) ────────────────────────────────────────────
--
-- Phase 1A originally shipped these as SECURITY INVOKER, reasoning that
-- existing RLS policies (`auth.uid() = user_id`, confirmed via
-- pg_policies) would keep applying underneath. That is correct today, but
-- incompatible with Phase 3C's intended end state: Phase 3C revokes
-- direct INSERT/UPDATE/DELETE table privileges from `authenticated` so
-- mutations can only happen through this RPC boundary. A SECURITY INVOKER
-- function runs with the CALLER's privileges — once those table
-- privileges are revoked, the invoker-mode RPC would lose them too and
-- stop working. SECURITY DEFINER runs with the FUNCTION OWNER's
-- privileges instead (a trusted admin role — see the ALTER FUNCTION OWNER
-- TO statements below), so it keeps working after the caller's own direct
-- table privileges are gone. Hardening this now, while nothing depends on
-- it yet, means Phase 3C's later privilege revocation is a pure
-- subtraction with a boundary that's already been proven to survive it —
-- verified this session by literally simulating that revoked state
-- against a disposable Postgres instance (see this session's manual
-- verification notes; not committed as a live-DB automated test, per this
-- repo's existing convention of DB-free committed tests).
--
-- Because SECURITY DEFINER functions can see and touch rows regardless of
-- RLS (the owner role bypasses RLS on these tables), RLS is no longer a
-- backstop for THESE functions specifically — direct table access from
-- authenticated/anon still goes through RLS as before (unaffected), but
-- every read and write inside these six functions must enforce ownership
-- itself. Concretely: every single SELECT/UPDATE/DELETE in every function
-- below — not just the mutating statement, but every read-back used to
-- build the response — includes an explicit `user_id = v_caller` (or
-- `w.user_id = v_caller`) predicate. A caller who knows another user's id/
-- dayKey/syncVersion gets exactly 'not_found' or an empty create_conflict
-- result, never that user's row content, from any branch.
--
-- search_path is pinned to the empty string (stronger than the previous
-- `SET search_path = public`), and every relation/function reference is
-- fully schema-qualified (public.saved_outfits, public.week_plan,
-- auth.uid()) so name resolution can never be redirected by a caller-
-- controlled search_path. Built-in types/functions (uuid, text, jsonb,
-- timestamptz, now(), NULL::x casts) still resolve fine with an empty
-- search_path — pg_catalog is always implicitly searched regardless.
--
-- Function ownership: each function gets an explicit
-- `ALTER FUNCTION ... OWNER TO postgres;` immediately after its
-- CREATE OR REPLACE, rather than leaving ownership as "whichever role
-- happened to run this SQL." `postgres` is the Supabase project's trusted
-- admin role — never authenticated/anon/service_role, and never an
-- application-controlled identity. If your project's admin role is named
-- differently, adjust this before applying.
--
-- Missing-baseVersion ("create") semantics: create only succeeds if no row
-- exists yet for that identity (id, or (user_id, day_key)) — implemented
-- as INSERT ... ON CONFLICT DO NOTHING. It is never an unconditional
-- overwrite. If a row already exists, the function returns
-- 'create_conflict' plus that row's authoritative current state IF it
-- belongs to the caller — if it belongs to someone else, the ownership-
-- scoped read-back returns nothing at all, so no row is ever leaked.
--
-- Update/delete both require an exact sync_version match (optimistic
-- concurrency / CAS), AND ownership match — a stale-but-correctly-owned
-- version and a current-but-wrongly-owned attempt both fail identically
-- from the caller's point of view (never distinguishable). Delete is
-- always soft: it sets deleted_at and bumps sync_version, and never
-- physically removes the row through these functions. A version-matched,
-- ownership-matched update always clears deleted_at as part of applying —
-- this is the "deliberate re-assignment as a legitimate CAS against the
-- tombstone's current version" case from the design (e.g. re-assigning a
-- previously-cleared week_plan day), not an "automatic undelete" of a
-- stale write: a STALE update (wrong baseVersion) can never reach this
-- branch at all, because the WHERE clause's version-match fails first and
-- the whole statement is a no-op.
--
-- Result contract: every function returns a single row shaped like the
-- underlying table plus a leading `status` column, one of:
--   'created'         — create succeeded, row is new
--   'create_conflict' — an id/day already exists; row is its current
--                        state IF the caller owns it, otherwise the
--                        function returns NO ROWS (never someone else's
--                        content)
--   'applied'         — update/delete succeeded under the given
--                        baseVersion, for the caller's own row
--   'conflict'        — the caller owns this record but baseVersion
--                        didn't match; row is current state
--   'not_found'       — no row exists for this identity that the CALLER
--                        owns (indistinguishable from "belongs to someone
--                        else" — this is deliberate, see below)
-- Callers get the authoritative row back on every branch except
-- 'not_found', so a follow-up fetch is never needed to see what actually
-- happened.
--
-- Ownership: caller identity comes only from auth.uid(), never a
-- client-supplied user_id — there is no user_id parameter on any function
-- below. A caller who knows another user's id/dayKey/syncVersion cannot
-- read, mutate, delete, resurrect, or even infer that record's existence:
-- every non-owning attempt collapses to 'not_found' (updates/deletes) or
-- an empty result set (create_conflict on someone else's id), which is
-- indistinguishable from "nothing exists at all" — verified this session
-- against a disposable Postgres instance covering both saved_outfits and
-- week_plan.
--
-- RETURNS TABLE columns are all `out_`-prefixed. Verified against a real
-- disposable Postgres instance during Phase 1A: RETURNS TABLE columns
-- become implicit PL/pgSQL variables visible for the whole function body,
-- and an unprefixed `id`/`user_id`/etc. collides with the identically-named
-- table column inside `ON CONFLICT (id)` (whose target list cannot be
-- table-qualified to disambiguate) and inside unqualified WHERE clauses —
-- Postgres raises "column reference is ambiguous" for both. The prefix
-- avoids the whole class of collision; callers read fields by name off the
-- returned row exactly as before, just without the `out_` prefix meaning
-- anything to them beyond a plain field name.
--
-- Mutable system fields: the client never controls sync_version (always
-- 1 on create, always `+ 1` off the row's own current value on
-- update/delete — never a caller-supplied absolute value), deleted_at
-- (always NULL on create/update, always now() on delete — never a
-- parameter), or user_id/ownership (always auth.uid(), never a
-- parameter). Every function's parameter list only accepts the specific
-- content fields a client legitimately supplies — never a raw JSON blob
-- spread onto the row.
--
-- Cross-user identity/collision semantics (Part 3 of this session's
-- corrections) — documented per table, not papered over with a bare error
-- catch:
--   saved_outfits: PRIMARY KEY (id) alone — a GLOBAL identity space, not
--   user-scoped. This is intentional: id is a client-generated UUID
--   naming one specific saved-outfit record, the same way any UUID-PK'd
--   document collection works; there is no legitimate scenario where two
--   different users are "supposed to" share an id (unlike week_plan's
--   day_key, a genuinely reusable per-user slot label). A same-id
--   collision across two different users can only happen via
--   astronomically unlikely UUIDv4 collision or a malicious/buggy client
--   deliberately reusing an id it observed elsewhere — create_saved_outfit
--   handles this safely (ON CONFLICT DO NOTHING, ownership-scoped
--   read-back returns nothing if the existing row isn't the caller's), but
--   the schema itself does not need to (and should not) enforce
--   user-scoped uniqueness on top of a deliberately-global identity space.
--   week_plan: PRIMARY KEY (user_id, day_key) — genuinely user-scoped by
--   construction. Two different users can and routinely do have a row
--   with the same day_key ('mon', 'tue', ...); their PK tuples always
--   differ because user_id differs, so a cross-user PK collision is not
--   just handled defensively, it is not even physically representable —
--   verified this session by having two different users each successfully
--   create a week_plan row for the same day_key with zero interaction
--   between them.

-- ── saved_outfits ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_saved_outfit(
  p_id text,
  p_request_id text,
  p_saved_at timestamptz,
  p_input jsonb,
  p_recommendation jsonb
)
RETURNS TABLE (
  out_status text,
  out_id text,
  out_user_id uuid,
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

  INSERT INTO public.saved_outfits (id, user_id, request_id, saved_at, input, recommendation, sync_version, deleted_at)
  VALUES (p_id, v_caller, p_request_id, p_saved_at, p_input, p_recommendation, 1, NULL)
  ON CONFLICT (id) DO NOTHING;

  IF FOUND THEN
    RETURN QUERY
      SELECT 'created', s.id, s.user_id, s.request_id, s.saved_at, s.input, s.recommendation, s.sync_version, s.deleted_at
      FROM public.saved_outfits s WHERE s.id = p_id AND s.user_id = v_caller;
  ELSE
    RETURN QUERY
      SELECT 'create_conflict', s.id, s.user_id, s.request_id, s.saved_at, s.input, s.recommendation, s.sync_version, s.deleted_at
      FROM public.saved_outfits s WHERE s.id = p_id AND s.user_id = v_caller;
  END IF;
END;
$$;

ALTER FUNCTION public.create_saved_outfit(text, text, timestamptz, jsonb, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_saved_outfit(text, text, timestamptz, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_saved_outfit(text, text, timestamptz, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_saved_outfit(text, text, timestamptz, jsonb, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_saved_outfit(
  p_id text,
  p_base_version integer,
  p_request_id text,
  p_saved_at timestamptz,
  p_input jsonb,
  p_recommendation jsonb
)
RETURNS TABLE (
  out_status text,
  out_id text,
  out_user_id uuid,
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

  UPDATE public.saved_outfits s
     SET request_id = p_request_id,
         saved_at = p_saved_at,
         input = p_input,
         recommendation = p_recommendation,
         sync_version = s.sync_version + 1,
         deleted_at = NULL
   WHERE s.id = p_id
     AND s.user_id = v_caller
     AND s.sync_version = p_base_version;

  IF FOUND THEN
    RETURN QUERY
      SELECT 'applied', s.id, s.user_id, s.request_id, s.saved_at, s.input, s.recommendation, s.sync_version, s.deleted_at
      FROM public.saved_outfits s WHERE s.id = p_id AND s.user_id = v_caller;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.saved_outfits s WHERE s.id = p_id AND s.user_id = v_caller) THEN
    RETURN QUERY
      SELECT 'conflict', s.id, s.user_id, s.request_id, s.saved_at, s.input, s.recommendation, s.sync_version, s.deleted_at
      FROM public.saved_outfits s WHERE s.id = p_id AND s.user_id = v_caller;
  ELSE
    RETURN QUERY
      SELECT 'not_found', NULL::uuid, NULL::uuid, NULL::text, NULL::timestamptz, NULL::jsonb, NULL::jsonb, NULL::integer, NULL::timestamptz;
  END IF;
END;
$$;

ALTER FUNCTION public.update_saved_outfit(text, integer, text, timestamptz, jsonb, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.update_saved_outfit(text, integer, text, timestamptz, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_saved_outfit(text, integer, text, timestamptz, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_saved_outfit(text, integer, text, timestamptz, jsonb, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_saved_outfit(
  p_id text,
  p_base_version integer
)
RETURNS TABLE (
  out_status text,
  out_id text,
  out_user_id uuid,
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

  UPDATE public.saved_outfits s
     SET deleted_at = now(),
         sync_version = s.sync_version + 1
   WHERE s.id = p_id
     AND s.user_id = v_caller
     AND s.sync_version = p_base_version;

  IF FOUND THEN
    RETURN QUERY
      SELECT 'applied', s.id, s.user_id, s.request_id, s.saved_at, s.input, s.recommendation, s.sync_version, s.deleted_at
      FROM public.saved_outfits s WHERE s.id = p_id AND s.user_id = v_caller;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.saved_outfits s WHERE s.id = p_id AND s.user_id = v_caller) THEN
    RETURN QUERY
      SELECT 'conflict', s.id, s.user_id, s.request_id, s.saved_at, s.input, s.recommendation, s.sync_version, s.deleted_at
      FROM public.saved_outfits s WHERE s.id = p_id AND s.user_id = v_caller;
  ELSE
    RETURN QUERY
      SELECT 'not_found', NULL::uuid, NULL::uuid, NULL::text, NULL::timestamptz, NULL::jsonb, NULL::jsonb, NULL::integer, NULL::timestamptz;
  END IF;
END;
$$;

ALTER FUNCTION public.delete_saved_outfit(text, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.delete_saved_outfit(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_saved_outfit(text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_saved_outfit(text, integer) TO authenticated;

-- ── week_plan ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_week_plan_item(
  p_day_key text,
  p_day_label text,
  p_request_id text,
  p_assigned_at timestamptz,
  p_input jsonb,
  p_recommendation jsonb
)
RETURNS TABLE (
  out_status text,
  out_user_id uuid,
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

  INSERT INTO public.week_plan (user_id, day_key, day_label, request_id, assigned_at, input, recommendation, sync_version, deleted_at)
  VALUES (v_caller, p_day_key, p_day_label, p_request_id, p_assigned_at, p_input, p_recommendation, 1, NULL)
  ON CONFLICT (user_id, day_key) DO NOTHING;

  IF FOUND THEN
    RETURN QUERY
      SELECT 'created', w.user_id, w.day_key, w.day_label, w.request_id, w.assigned_at, w.input, w.recommendation, w.sync_version, w.deleted_at
      FROM public.week_plan w WHERE w.user_id = v_caller AND w.day_key = p_day_key;
  ELSE
    RETURN QUERY
      SELECT 'create_conflict', w.user_id, w.day_key, w.day_label, w.request_id, w.assigned_at, w.input, w.recommendation, w.sync_version, w.deleted_at
      FROM public.week_plan w WHERE w.user_id = v_caller AND w.day_key = p_day_key;
  END IF;
END;
$$;

ALTER FUNCTION public.create_week_plan_item(text, text, text, timestamptz, jsonb, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_week_plan_item(text, text, text, timestamptz, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_week_plan_item(text, text, text, timestamptz, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_week_plan_item(text, text, text, timestamptz, jsonb, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_week_plan_item(
  p_day_key text,
  p_base_version integer,
  p_day_label text,
  p_request_id text,
  p_assigned_at timestamptz,
  p_input jsonb,
  p_recommendation jsonb
)
RETURNS TABLE (
  out_status text,
  out_user_id uuid,
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

  UPDATE public.week_plan w
     SET day_label = p_day_label,
         request_id = p_request_id,
         assigned_at = p_assigned_at,
         input = p_input,
         recommendation = p_recommendation,
         sync_version = w.sync_version + 1,
         deleted_at = NULL
   WHERE w.user_id = v_caller
     AND w.day_key = p_day_key
     AND w.sync_version = p_base_version;

  IF FOUND THEN
    RETURN QUERY
      SELECT 'applied', w.user_id, w.day_key, w.day_label, w.request_id, w.assigned_at, w.input, w.recommendation, w.sync_version, w.deleted_at
      FROM public.week_plan w WHERE w.user_id = v_caller AND w.day_key = p_day_key;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.week_plan w WHERE w.user_id = v_caller AND w.day_key = p_day_key) THEN
    RETURN QUERY
      SELECT 'conflict', w.user_id, w.day_key, w.day_label, w.request_id, w.assigned_at, w.input, w.recommendation, w.sync_version, w.deleted_at
      FROM public.week_plan w WHERE w.user_id = v_caller AND w.day_key = p_day_key;
  ELSE
    RETURN QUERY
      SELECT 'not_found', NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::timestamptz, NULL::jsonb, NULL::jsonb, NULL::integer, NULL::timestamptz;
  END IF;
END;
$$;

ALTER FUNCTION public.update_week_plan_item(text, integer, text, text, timestamptz, jsonb, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.update_week_plan_item(text, integer, text, text, timestamptz, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_week_plan_item(text, integer, text, text, timestamptz, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_week_plan_item(text, integer, text, text, timestamptz, jsonb, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_week_plan_item(
  p_day_key text,
  p_base_version integer
)
RETURNS TABLE (
  out_status text,
  out_user_id uuid,
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

  UPDATE public.week_plan w
     SET deleted_at = now(),
         sync_version = w.sync_version + 1
   WHERE w.user_id = v_caller
     AND w.day_key = p_day_key
     AND w.sync_version = p_base_version;

  IF FOUND THEN
    RETURN QUERY
      SELECT 'applied', w.user_id, w.day_key, w.day_label, w.request_id, w.assigned_at, w.input, w.recommendation, w.sync_version, w.deleted_at
      FROM public.week_plan w WHERE w.user_id = v_caller AND w.day_key = p_day_key;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.week_plan w WHERE w.user_id = v_caller AND w.day_key = p_day_key) THEN
    RETURN QUERY
      SELECT 'conflict', w.user_id, w.day_key, w.day_label, w.request_id, w.assigned_at, w.input, w.recommendation, w.sync_version, w.deleted_at
      FROM public.week_plan w WHERE w.user_id = v_caller AND w.day_key = p_day_key;
  ELSE
    RETURN QUERY
      SELECT 'not_found', NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::timestamptz, NULL::jsonb, NULL::jsonb, NULL::integer, NULL::timestamptz;
  END IF;
END;
$$;

ALTER FUNCTION public.delete_week_plan_item(text, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.delete_week_plan_item(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_week_plan_item(text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_week_plan_item(text, integer) TO authenticated;
