-- Add supabaseUserId to UserProfile and ClosetItem so that every backend
-- record is tied to a specific Supabase auth user. Nullable so existing rows
-- are not broken — they simply become unreachable via the new user-scoped
-- queries and will be superseded when each user next completes onboarding.

ALTER TABLE "UserProfile" ADD COLUMN "supabaseUserId" TEXT;
CREATE INDEX "UserProfile_supabaseUserId_idx" ON "UserProfile"("supabaseUserId");

ALTER TABLE "ClosetItem" ADD COLUMN "supabaseUserId" TEXT;
CREATE INDEX "ClosetItem_supabaseUserId_idx" ON "ClosetItem"("supabaseUserId");
