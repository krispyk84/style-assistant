-- CreateEnum
CREATE TYPE "OutfitTier" AS ENUM ('BUSINESS', 'SMART_CASUAL', 'CASUAL');

-- CreateEnum
CREATE TYPE "AnalysisVerdict" AS ENUM ('WORKS_GREAT', 'WORKS_OKAY', 'DOESNT_WORK');

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "heightCm" INTEGER NOT NULL,
    "weightKg" INTEGER NOT NULL,
    "fitPreference" TEXT NOT NULL,
    "stylePreference" TEXT NOT NULL,
    "budget" TEXT NOT NULL,
    "hairColor" TEXT NOT NULL,
    "skinTone" TEXT NOT NULL,
    "notes" TEXT,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutfitRequest" (
    "id" TEXT NOT NULL,
    "profileId" TEXT,
    "anchorItemDescription" TEXT NOT NULL,
    "anchorImageUrl" TEXT,
    "photoPending" BOOLEAN NOT NULL DEFAULT false,
    "selectedTiers" "OutfitTier"[],
    "promptVersion" TEXT NOT NULL DEFAULT 'mock-v1',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutfitRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutfitResult" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "rawResponse" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutfitResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TierResult" (
    "id" TEXT NOT NULL,
    "outfitResultId" TEXT NOT NULL,
    "tier" "OutfitTier" NOT NULL,
    "title" TEXT NOT NULL,
    "anchorItem" TEXT NOT NULL,
    "keyPieces" JSONB NOT NULL,
    "shoes" JSONB NOT NULL,
    "accessories" JSONB NOT NULL,
    "fitNotes" JSONB NOT NULL,
    "whyItWorks" TEXT NOT NULL,
    "stylingDirection" TEXT NOT NULL,
    "detailNotes" JSONB NOT NULL,
    "variantIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TierResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompatibilityCheck" (
    "id" TEXT NOT NULL,
    "profileId" TEXT,
    "imageUrl" TEXT,
    "imageFilename" TEXT,
    "verdict" "AnalysisVerdict" NOT NULL,
    "stylistNotes" JSONB NOT NULL,
    "suggestedChanges" JSONB NOT NULL,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompatibilityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelfieReview" (
    "id" TEXT NOT NULL,
    "profileId" TEXT,
    "imageUrl" TEXT,
    "imageFilename" TEXT,
    "verdict" "AnalysisVerdict" NOT NULL,
    "stylistNotes" JSONB NOT NULL,
    "suggestedChanges" JSONB NOT NULL,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SelfieReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutfitResult_requestId_key" ON "OutfitResult"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "TierResult_outfitResultId_tier_key" ON "TierResult"("outfitResultId", "tier");

-- AddForeignKey
ALTER TABLE "OutfitRequest" ADD CONSTRAINT "OutfitRequest_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutfitResult" ADD CONSTRAINT "OutfitResult_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "OutfitRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TierResult" ADD CONSTRAINT "TierResult_outfitResultId_fkey" FOREIGN KEY ("outfitResultId") REFERENCES "OutfitResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompatibilityCheck" ADD CONSTRAINT "CompatibilityCheck_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelfieReview" ADD CONSTRAINT "SelfieReview_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
