-- CreateTable
CREATE TABLE "HaircutSession" (
    "id"               TEXT NOT NULL,
    "supabaseUserId"   TEXT NOT NULL,
    "headshotImageUrl" TEXT NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HaircutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HaircutOption" (
    "id"              TEXT NOT NULL,
    "sessionId"       TEXT NOT NULL,
    "styleKey"        TEXT NOT NULL,
    "styleLabel"      TEXT NOT NULL,
    "styleSummary"    TEXT NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'pending',
    "imageStorageKey" TEXT,
    "imageMimeType"   TEXT,
    "imageData"       BYTEA,
    "errorCode"       TEXT,
    "errorMessage"    TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HaircutOption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HaircutSession_supabaseUserId_idx" ON "HaircutSession"("supabaseUserId");
CREATE INDEX "HaircutOption_sessionId_idx" ON "HaircutOption"("sessionId");

-- AddForeignKey
ALTER TABLE "HaircutOption" ADD CONSTRAINT "HaircutOption_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "HaircutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
