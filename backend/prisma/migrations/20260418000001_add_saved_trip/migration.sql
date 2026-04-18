CREATE TABLE "SavedTrip" (
    "id"             TEXT NOT NULL,
    "supabaseUserId" TEXT NOT NULL,
    "tripId"         TEXT NOT NULL,
    "destination"    TEXT NOT NULL,
    "country"        TEXT NOT NULL,
    "departureDate"  TEXT NOT NULL,
    "returnDate"     TEXT NOT NULL,
    "travelParty"    TEXT NOT NULL,
    "climateLabel"   TEXT NOT NULL,
    "styleVibe"      TEXT NOT NULL,
    "purposes"       JSONB NOT NULL,
    "activities"     TEXT,
    "dressCode"      TEXT,
    "days"           JSONB NOT NULL,
    "savedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedTrip_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedTrip_supabaseUserId_tripId_key" ON "SavedTrip"("supabaseUserId", "tripId");
CREATE INDEX "SavedTrip_supabaseUserId_idx" ON "SavedTrip"("supabaseUserId");
