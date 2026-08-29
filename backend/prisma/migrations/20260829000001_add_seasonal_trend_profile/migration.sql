-- CreateTable
CREATE TABLE "SeasonalTrendProfile" (
    "id"            TEXT NOT NULL,
    "season"        TEXT NOT NULL,
    "year"          INTEGER NOT NULL,
    "fashionGender" TEXT NOT NULL,
    "hemisphere"    TEXT NOT NULL,
    "region"        TEXT,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "status"        TEXT NOT NULL DEFAULT 'valid',
    "business"      JSONB NOT NULL,
    "smartCasual"   JSONB NOT NULL,
    "casual"        JSONB NOT NULL,
    "invalidReason" TEXT,
    "generatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonalTrendProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeasonalTrendProfile_season_year_fashionGender_hemisphere_key" ON "SeasonalTrendProfile"("season", "year", "fashionGender", "hemisphere");
CREATE INDEX "SeasonalTrendProfile_fashionGender_hemisphere_status_createdAt_idx" ON "SeasonalTrendProfile"("fashionGender", "hemisphere", "status", "createdAt" DESC);
