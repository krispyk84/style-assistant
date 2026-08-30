-- CreateTable
CREATE TABLE "SeasonalColorPalette" (
    "id"            TEXT NOT NULL,
    "season"        TEXT NOT NULL,
    "year"          INTEGER NOT NULL,
    "fashionGender" TEXT NOT NULL,
    "hemisphere"    TEXT NOT NULL,
    "region"        TEXT,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "status"        TEXT NOT NULL DEFAULT 'valid',
    "colors"        JSONB NOT NULL,
    "invalidReason" TEXT,
    "generatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonalColorPalette_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeasonalColorPalette_season_year_fashionGender_hemisphere_key" ON "SeasonalColorPalette"("season", "year", "fashionGender", "hemisphere");
CREATE INDEX "SeasonalColorPalette_fashionGender_hemisphere_status_createdAt_idx" ON "SeasonalColorPalette"("fashionGender", "hemisphere", "status", "createdAt" DESC);

-- CreateTable
CREATE TABLE "ColorSwatchSketch" (
    "id"               TEXT NOT NULL,
    "fashionGender"    TEXT NOT NULL,
    "colorNameKey"     TEXT NOT NULL,
    "colorName"        TEXT NOT NULL,
    "colorData"        JSONB,
    "status"           TEXT NOT NULL DEFAULT 'pending',
    "sketchStorageKey" TEXT,
    "sketchMimeType"   TEXT,
    "sketchImageData"  BYTEA,
    "errorCode"        TEXT,
    "errorMessage"     TEXT,
    "firstGeneratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColorSwatchSketch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ColorSwatchSketch_fashionGender_colorNameKey_key" ON "ColorSwatchSketch"("fashionGender", "colorNameKey");
CREATE INDEX "ColorSwatchSketch_fashionGender_status_idx" ON "ColorSwatchSketch"("fashionGender", "status");
