CREATE TABLE "ClosetAnalysisSnapshot" (
    "id"                 TEXT NOT NULL,
    "supabaseUserId"     TEXT NOT NULL,
    "closetHash"         TEXT NOT NULL,
    "itemCount"          INTEGER NOT NULL,
    "totalScore"         INTEGER NOT NULL,
    "formalityRange"     INTEGER NOT NULL,
    "colorVersatility"   INTEGER NOT NULL,
    "seasonalCoverage"   INTEGER NOT NULL,
    "layeringOptions"    INTEGER NOT NULL,
    "occasionCoverage"   INTEGER NOT NULL,
    "summary"            TEXT NOT NULL,
    "deficientCategory"  TEXT NOT NULL,
    "excessCategory"     TEXT NOT NULL,
    "itemSignatures"     TEXT[],
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClosetAnalysisSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClosetAnalysisSnapshot_supabaseUserId_createdAt_idx" ON "ClosetAnalysisSnapshot"("supabaseUserId", "createdAt" DESC);
