-- CreateTable
CREATE TABLE "TrendFeedback" (
    "id"             TEXT NOT NULL,
    "supabaseUserId" TEXT NOT NULL,
    "fashionGender"  TEXT NOT NULL,
    "trendNameKey"   TEXT NOT NULL,
    "feedback"       TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrendFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrendFeedback_supabaseUserId_fashionGender_trendNameKey_key" ON "TrendFeedback"("supabaseUserId", "fashionGender", "trendNameKey");
CREATE INDEX "TrendFeedback_supabaseUserId_fashionGender_idx" ON "TrendFeedback"("supabaseUserId", "fashionGender");
