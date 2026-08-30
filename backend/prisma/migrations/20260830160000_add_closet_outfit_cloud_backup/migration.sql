-- Cloud backup for "Create Outfits From My Closet" favourites and week plan.
-- This data previously lived ONLY in on-device AsyncStorage with no server
-- copy at all — clearing local storage (e.g. the sign-out cleanup sweep)
-- permanently destroyed it with no way to recover.
CREATE TABLE "ClosetOutfitFavourite" (
    "id"             TEXT NOT NULL,
    "supabaseUserId" TEXT NOT NULL,
    "formality"      TEXT NOT NULL,
    "outfit"         JSONB NOT NULL,
    "savedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClosetOutfitFavourite_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClosetOutfitFavourite_supabaseUserId_idx" ON "ClosetOutfitFavourite"("supabaseUserId");

CREATE TABLE "ClosetOutfitWeekPlanItem" (
    "id"             TEXT NOT NULL,
    "supabaseUserId" TEXT NOT NULL,
    "dayKey"         TEXT NOT NULL,
    "dayLabel"       TEXT NOT NULL,
    "formality"      TEXT NOT NULL,
    "outfit"         JSONB NOT NULL,
    "assignedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClosetOutfitWeekPlanItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClosetOutfitWeekPlanItem_supabaseUserId_dayKey_key" ON "ClosetOutfitWeekPlanItem"("supabaseUserId", "dayKey");
CREATE INDEX "ClosetOutfitWeekPlanItem_supabaseUserId_idx" ON "ClosetOutfitWeekPlanItem"("supabaseUserId");
