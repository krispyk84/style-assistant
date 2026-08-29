-- CreateTable
CREATE TABLE "TrendSketch" (
    "id"               TEXT NOT NULL,
    "fashionGender"    TEXT NOT NULL,
    "trendNameKey"     TEXT NOT NULL,
    "trendName"        TEXT NOT NULL,
    "formality"        TEXT NOT NULL,
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

    CONSTRAINT "TrendSketch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrendSketch_fashionGender_trendNameKey_key" ON "TrendSketch"("fashionGender", "trendNameKey");
CREATE INDEX "TrendSketch_fashionGender_status_idx" ON "TrendSketch"("fashionGender", "status");
