-- Phase 0 of the local<->cloud synchronization redesign — additive only.
--
-- saved_outfits and week_plan are accessed directly via supabase-js
-- (lib/supabase-data.ts), not modeled in schema.prisma or written by the
-- backend at all — but this migration folder is the existing, already-
-- trusted mechanism for applying schema changes to the shared Supabase
-- Postgres instance on every backend deploy (prisma migrate deploy, via
-- `npm run start:migrate`), so it's reused here rather than standing up a
-- separate Supabase-migration-tracking system for just these two tables.
-- Deliberately no corresponding Prisma model is added — these statements
-- are inert from Prisma's own schema-drift-detection.
--
-- IF NOT EXISTS makes this safely re-runnable. Column names follow these
-- two tables' existing snake_case convention (user_id, day_key, saved_at),
-- not Prisma's camelCase.
--
-- Every existing row's SELECT('*') already only feeds a fromRow() mapper
-- that reads specific named fields (lib/supabase-data.ts) — these new
-- columns are invisible to every current read/write path until a later
-- phase explicitly starts using them.
ALTER TABLE saved_outfits ADD COLUMN IF NOT EXISTS sync_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE saved_outfits ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE week_plan ADD COLUMN IF NOT EXISTS sync_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE week_plan ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
