-- CreateTable
CREATE TABLE "ClosetOutfitFeedback" (
    "id"             TEXT NOT NULL,
    "supabaseUserId" TEXT NOT NULL,
    "formality"      TEXT NOT NULL,
    "title"          TEXT NOT NULL,
    "itemIds"        JSONB NOT NULL,
    "feedback"       TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClosetOutfitFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClosetOutfitFeedback_supabaseUserId_createdAt_idx" ON "ClosetOutfitFeedback"("supabaseUserId", "createdAt" DESC);
CREATE INDEX "ClosetOutfitFeedback_supabaseUserId_feedback_idx" ON "ClosetOutfitFeedback"("supabaseUserId", "feedback");
