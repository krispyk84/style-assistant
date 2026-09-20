-- CreateTable
CREATE TABLE "Fragrance" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "concentration" TEXT,
    "normalizedBrand" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "topNotes" JSONB,
    "middleNotes" JSONB,
    "baseNotes" JSONB,
    "mainAccords" JSONB,
    "primaryVibe" TEXT,
    "secondaryVibes" JSONB,
    "seasonality" JSONB,
    "dayNight" JSONB,
    "formality" JSONB,
    "profileSource" TEXT NOT NULL DEFAULT 'manual',
    "profileModel" TEXT,
    "profileVersion" TEXT,
    "profileConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fragrance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFragrance" (
    "id" TEXT NOT NULL,
    "supabaseUserId" TEXT NOT NULL,
    "fragranceId" TEXT NOT NULL,
    "originalImageUrl" TEXT,
    "bottleSketchUrl" TEXT,
    "bottleSketchStatus" TEXT NOT NULL DEFAULT 'not_started',
    "isSignature" BOOLEAN NOT NULL DEFAULT false,
    "currentVolumeMl" INTEGER,
    "userNotes" TEXT,
    "profileOverrides" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFragrance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Fragrance_canonicalKey_key" ON "Fragrance"("canonicalKey");

-- CreateIndex
CREATE INDEX "Fragrance_normalizedBrand_idx" ON "Fragrance"("normalizedBrand");

-- CreateIndex
CREATE INDEX "Fragrance_normalizedName_idx" ON "Fragrance"("normalizedName");

-- CreateIndex
CREATE INDEX "UserFragrance_supabaseUserId_idx" ON "UserFragrance"("supabaseUserId");

-- CreateIndex
CREATE INDEX "UserFragrance_fragranceId_idx" ON "UserFragrance"("fragranceId");

-- CreateIndex
CREATE UNIQUE INDEX "UserFragrance_supabaseUserId_fragranceId_key" ON "UserFragrance"("supabaseUserId", "fragranceId");

-- AddForeignKey
ALTER TABLE "UserFragrance" ADD CONSTRAINT "UserFragrance_fragranceId_fkey" FOREIGN KEY ("fragranceId") REFERENCES "Fragrance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

