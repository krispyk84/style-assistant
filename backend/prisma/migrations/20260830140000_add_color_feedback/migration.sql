-- CreateTable
CREATE TABLE "ColorFeedback" (
    "id"             TEXT NOT NULL,
    "supabaseUserId" TEXT NOT NULL,
    "fashionGender"  TEXT NOT NULL,
    "colorNameKey"   TEXT NOT NULL,
    "feedback"       TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColorFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ColorFeedback_supabaseUserId_fashionGender_colorNameKey_key" ON "ColorFeedback"("supabaseUserId", "fashionGender", "colorNameKey");
CREATE INDEX "ColorFeedback_supabaseUserId_fashionGender_idx" ON "ColorFeedback"("supabaseUserId", "fashionGender");
