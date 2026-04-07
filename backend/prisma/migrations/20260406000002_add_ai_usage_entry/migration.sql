-- CreateTable
CREATE TABLE "AiUsageEntry" (
    "id" TEXT NOT NULL,
    "supabaseUserId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsageEntry_supabaseUserId_monthKey_idx" ON "AiUsageEntry"("supabaseUserId", "monthKey");
