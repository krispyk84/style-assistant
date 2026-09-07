-- Phase 0 of the local<->cloud synchronization redesign — additive only.
-- No behavior change: nothing reads or requires these columns yet, no
-- privileges change, no existing row is rewritten beyond gaining a default
-- value for the two new columns.
--
-- syncVersion starts every existing row at 1, giving Phase 1+'s optimistic-
-- concurrency checks a meaningful, uniform baseline instead of a null gap.
-- deletedAt stays null for every existing row — this domain still performs
-- a physical delete today (closet-outfit-sync.repository.ts), so nothing
-- is currently soft-deleted; tombstone behavior is introduced in a later
-- phase, not this one.
ALTER TABLE "ClosetOutfitFavourite" ADD COLUMN "syncVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ClosetOutfitFavourite" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "ClosetOutfitWeekPlanItem" ADD COLUMN "syncVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ClosetOutfitWeekPlanItem" ADD COLUMN "deletedAt" TIMESTAMP(3);
