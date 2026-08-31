-- TripPlan/TripAnchor were added to schema.prisma back in commit 4da580b4
-- ("Add Trip Anchors screen and 8-day trip limit") but no migration was ever
-- written for them — they have never actually existed in production. This
-- surfaced when a later ALTER TABLE migration (adding TripPlan.rewearOk)
-- failed with "relation TripPlan does not exist" (error 42P01) and got stuck
-- in the migrations table as a failed entry, blocking all further deploys.
-- That broken migration was deleted and replaced by this one, which creates
-- both tables as they should have existed from the start (rewearOk included
-- directly, since there was never a working table to ALTER in the first
-- place). The production database's failed-migration record for the deleted
-- migration must be resolved via `prisma migrate resolve --rolled-back
-- 20260831000000_add_trip_plan_rewear_ok` before this one can apply.

CREATE TABLE "TripPlan" (
    "id"             TEXT NOT NULL,
    "supabaseUserId" TEXT NOT NULL,
    "destination"    TEXT NOT NULL,
    "country"        TEXT NOT NULL,
    "departureDate"  TEXT NOT NULL,
    "returnDate"     TEXT NOT NULL,
    "numDays"        INTEGER NOT NULL,
    "travelParty"    TEXT NOT NULL,
    "purposes"       JSONB NOT NULL,
    "climateLabel"   TEXT NOT NULL,
    "styleVibe"      TEXT NOT NULL,
    "willSwim"       BOOLEAN NOT NULL DEFAULT false,
    "fancyNights"    BOOLEAN NOT NULL DEFAULT false,
    "workoutClothes" BOOLEAN NOT NULL DEFAULT false,
    "laundryAccess"  TEXT NOT NULL DEFAULT 'Unsure',
    "shoesCount"     TEXT NOT NULL DEFAULT '2',
    "carryOnOnly"    BOOLEAN NOT NULL DEFAULT false,
    "rewearOk"       BOOLEAN NOT NULL DEFAULT false,
    "activities"     TEXT,
    "dressCode"      TEXT,
    "specialNeeds"   TEXT,
    "anchorMode"     TEXT,
    "status"         TEXT NOT NULL DEFAULT 'draft',
    "tripId"         TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TripPlan_supabaseUserId_idx" ON "TripPlan"("supabaseUserId");

CREATE TABLE "TripAnchor" (
    "id"              TEXT NOT NULL,
    "tripPlanId"      TEXT NOT NULL,
    "supabaseUserId"  TEXT NOT NULL,
    "slotId"          TEXT,
    "label"           TEXT NOT NULL,
    "category"        TEXT NOT NULL,
    "source"          TEXT NOT NULL,
    "closetItemId"    TEXT,
    "uploadedImageId" TEXT,
    "imageUrl"        TEXT,
    "rationale"       TEXT,
    "position"        INTEGER NOT NULL DEFAULT 0,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripAnchor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TripAnchor_tripPlanId_idx" ON "TripAnchor"("tripPlanId");
CREATE INDEX "TripAnchor_supabaseUserId_idx" ON "TripAnchor"("supabaseUserId");

ALTER TABLE "TripAnchor" ADD CONSTRAINT "TripAnchor_tripPlanId_fkey" FOREIGN KEY ("tripPlanId") REFERENCES "TripPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
