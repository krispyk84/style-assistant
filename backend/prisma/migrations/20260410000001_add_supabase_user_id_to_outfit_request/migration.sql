-- Add supabaseUserId to OutfitRequest so that generated looks can be scoped
-- to a specific user without requiring a UserProfile record.
-- Nullable for backwards compatibility — existing rows simply won't appear
-- in the per-user history query until new looks are generated.

ALTER TABLE "OutfitRequest" ADD COLUMN "supabaseUserId" TEXT;
CREATE INDEX "OutfitRequest_supabaseUserId_idx" ON "OutfitRequest"("supabaseUserId");
