-- AlterTable
ALTER TABLE "HaircutSession" ADD COLUMN "savedAt" TIMESTAMP(3);
ALTER TABLE "HaircutSession" ADD COLUMN "chosenOptionId" TEXT;
ALTER TABLE "HaircutSession" ADD COLUMN "guideData" JSONB;

-- CreateIndex
CREATE INDEX "HaircutSession_supabaseUserId_savedAt_idx" ON "HaircutSession"("supabaseUserId", "savedAt");
