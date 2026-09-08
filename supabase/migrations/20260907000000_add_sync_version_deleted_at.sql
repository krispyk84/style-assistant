-- Phase 0 of the local<->cloud synchronization redesign — additive only.
--
-- saved_outfits and week_plan live in this app's Supabase project's own
-- Postgres database, reached only via supabase-js from the frontend
-- (lib/supabase-data.ts) — a genuinely SEPARATE database from the backend's
-- own Render-hosted Postgres (which Prisma/schema.prisma manages). There is
-- no connection string anywhere in this repo that reaches this database
-- from the backend, and no Supabase CLI project link exists here — so
-- unlike every other migration in this repo, this file is NOT applied
-- automatically by any deploy pipeline. It must be run manually, once,
-- via the Supabase dashboard's SQL Editor for this project:
--   https://supabase.com/dashboard/project/aiosmeylkwwyglxiykxv/sql/new
-- (or the Supabase CLI, if a project link is ever set up later).
--
-- This file is kept here purely for version-controlled documentation of
-- what was run and when — Postgres itself has no knowledge of "migration
-- history" for this database the way Prisma tracks it for the backend's.
--
-- IF NOT EXISTS makes this safely re-runnable if it's ever pasted in twice
-- by mistake. Column names follow these two tables' existing snake_case
-- convention (user_id, day_key, saved_at), not Prisma's camelCase.
--
-- Every existing row's SELECT('*') already only feeds a fromRow() mapper
-- that reads specific named fields (lib/supabase-data.ts) — these new
-- columns are invisible to every current read/write path until a later
-- phase explicitly starts using them.
ALTER TABLE saved_outfits ADD COLUMN IF NOT EXISTS sync_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE saved_outfits ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE week_plan ADD COLUMN IF NOT EXISTS sync_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE week_plan ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
