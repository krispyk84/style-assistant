-- AlterTable
ALTER TABLE "HaircutSession" ADD COLUMN "hemisphere" TEXT;
ALTER TABLE "HaircutSession" ADD COLUMN "region" TEXT;

-- CreateTable
CREATE TABLE "HaircutTrendProfile" (
    "id"            TEXT NOT NULL,
    "season"        TEXT NOT NULL,
    "year"          INTEGER NOT NULL,
    "hemisphere"    TEXT NOT NULL,
    "region"        TEXT,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "status"        TEXT NOT NULL DEFAULT 'valid',
    "styles"        JSONB NOT NULL,
    "invalidReason" TEXT,
    "generatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HaircutTrendProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HaircutTrendProfile_season_year_hemisphere_key" ON "HaircutTrendProfile"("season", "year", "hemisphere");
CREATE INDEX "HaircutTrendProfile_hemisphere_status_createdAt_idx" ON "HaircutTrendProfile"("hemisphere", "status", "createdAt" DESC);
