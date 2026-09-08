-- Phase 1A of the local<->cloud synchronization redesign.
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
-- Same manual-application note as the Phase 0 migration in this directory:
-- this database (the Supabase project's own Postgres) is not reachable by
-- this repo's `prisma migrate deploy` pipeline. Apply once, by hand, via
-- the Supabase dashboard SQL Editor:
--   https://supabase.com/dashboard/project/aiosmeylkwwyglxiykxv/sql/new
--
-- ── Design notes ────────────────────────────────────────────────────────
--
-- SECURITY INVOKER, not DEFINER: `pg_policies` (checked this session)
-- confirms both tables already carry an ALL-command RLS policy
-- `auth.uid() = user_id` (USING and WITH CHECK). Running these functions
-- as the invoking (authenticated) role means that policy keeps applying
-- underneath the function's own explicit ownership checks below — two
-- independent enforcement layers, not one. A SECURITY DEFINER function
-- would run as the function owner, which bypasses RLS (table owners
-- bypass their own RLS policies by default) and would need to fully
-- replicate what RLS already guarantees, for no benefit here.
--
-- Missing-baseVersion ("create") semantics: create only succeeds if no row
-- exists yet for that identity (id, or (user_id, day_key)) — implemented
-- as INSERT ... ON CONFLICT DO NOTHING. It is never an unconditional
-- overwrite. If a row already exists, the function returns
-- 'create_conflict' plus that row's authoritative current state.
--
-- Update/delete both require an exact sync_version match (optimistic
-- concurrency / CAS). Delete is always soft: it sets deleted_at and bumps
-- sync_version, and never physically removes the row through these
-- functions. A version-matched update always clears deleted_at as part of
-- applying — this is the "deliberate re-assignment as a legitimate CAS
-- against the tombstone's current version" case from the design (e.g.
-- re-assigning a previously-cleared week_plan day), not an "automatic
-- undelete" of a stale write: a STALE update (wrong baseVersion) can never
-- reach this branch at all, because the WHERE clause's version-match
-- fails first and the whole statement is a no-op.
--
-- Result contract: every function returns a single row shaped like the
-- underlying table plus a leading `status` column, one of:
--   'created'         — create succeeded, row is new
--   'create_conflict' — create found an existing row; row is its current state
--   'applied'         — update/delete succeeded under the given baseVersion
--   'conflict'        — update/delete's baseVersion didn't match; row is current state
--   'not_found'       — no row exists for this identity (visible to this caller)
-- Callers get the authoritative row back on every branch except
-- 'not_found', so a follow-up fetch is never needed to see what actually
-- happened.
--
-- Ownership: caller identity comes only from auth.uid(), never a
-- client-supplied user_id — there is no user_id parameter on any function
-- below. Every WHERE clause explicitly includes the caller's own uid, so
-- combined with RLS this is a defense-in-depth pair, not a single point of
-- failure either way.
--
-- RETURNS TABLE columns are all `out_`-prefixed. Verified against a real
-- disposable Postgres instance during this phase: RETURNS TABLE columns
-- become implicit PL/pgSQL variables visible for the whole function body,
-- and an unprefixed `id`/`user_id`/etc. collides with the identically-named
-- table column inside `ON CONFLICT (id)` (whose target list cannot be
-- table-qualified to disambiguate) and inside unqualified WHERE clauses —
-- Postgres raises "column reference is ambiguous" for both. The prefix
-- avoids the whole class of collision; callers read fields by name off the
-- returned row exactly as before, just without the `out_` prefix meaning
-- anything to them beyond a plain field name.

-- ── saved_outfits ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_saved_outfit(
  p_id uuid,
  p_request_id text,
  p_saved_at timestamptz,
  p_input jsonb,
  p_recommendation jsonb
)
RETURNS TABLE (
  out_status text,
  out_id uuid,
  out_user_id uuid,
  out_request_id text,
  out_saved_at timestamptz,
  out_input jsonb,
  out_recommendation jsonb,
  out_sync_version integer,
  out_deleted_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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
      FROM public.saved_outfits s WHERE s.id = p_id;
  ELSE
    RETURN QUERY
      SELECT 'create_conflict', s.id, s.user_id, s.request_id, s.saved_at, s.input, s.recommendation, s.sync_version, s.deleted_at
      FROM public.saved_outfits s WHERE s.id = p_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.create_saved_outfit(uuid, text, timestamptz, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_saved_outfit(uuid, text, timestamptz, jsonb, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_saved_outfit(
  p_id uuid,
  p_base_version integer,
  p_request_id text,
  p_saved_at timestamptz,
  p_input jsonb,
  p_recommendation jsonb
)
RETURNS TABLE (
  out_status text,
  out_id uuid,
  out_user_id uuid,
  out_request_id text,
  out_saved_at timestamptz,
  out_input jsonb,
  out_recommendation jsonb,
  out_sync_version integer,
  out_deleted_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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
      FROM public.saved_outfits s WHERE s.id = p_id;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.saved_outfits s WHERE s.id = p_id AND s.user_id = v_caller) THEN
    RETURN QUERY
      SELECT 'conflict', s.id, s.user_id, s.request_id, s.saved_at, s.input, s.recommendation, s.sync_version, s.deleted_at
      FROM public.saved_outfits s WHERE s.id = p_id;
  ELSE
    RETURN QUERY
      SELECT 'not_found', NULL::uuid, NULL::uuid, NULL::text, NULL::timestamptz, NULL::jsonb, NULL::jsonb, NULL::integer, NULL::timestamptz;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_saved_outfit(uuid, integer, text, timestamptz, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_saved_outfit(uuid, integer, text, timestamptz, jsonb, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_saved_outfit(
  p_id uuid,
  p_base_version integer
)
RETURNS TABLE (
  out_status text,
  out_id uuid,
  out_user_id uuid,
  out_request_id text,
  out_saved_at timestamptz,
  out_input jsonb,
  out_recommendation jsonb,
  out_sync_version integer,
  out_deleted_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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
      FROM public.saved_outfits s WHERE s.id = p_id;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.saved_outfits s WHERE s.id = p_id AND s.user_id = v_caller) THEN
    RETURN QUERY
      SELECT 'conflict', s.id, s.user_id, s.request_id, s.saved_at, s.input, s.recommendation, s.sync_version, s.deleted_at
      FROM public.saved_outfits s WHERE s.id = p_id;
  ELSE
    RETURN QUERY
      SELECT 'not_found', NULL::uuid, NULL::uuid, NULL::text, NULL::timestamptz, NULL::jsonb, NULL::jsonb, NULL::integer, NULL::timestamptz;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_saved_outfit(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_saved_outfit(uuid, integer) TO authenticated;

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
SECURITY INVOKER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.create_week_plan_item(text, text, text, timestamptz, jsonb, jsonb) FROM PUBLIC;
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
SECURITY INVOKER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.update_week_plan_item(text, integer, text, text, timestamptz, jsonb, jsonb) FROM PUBLIC;
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
SECURITY INVOKER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.delete_week_plan_item(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_week_plan_item(text, integer) TO authenticated;
