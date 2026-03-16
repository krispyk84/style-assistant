ALTER TABLE "TierResult"
ADD COLUMN "sketchStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "sketchImageUrl" TEXT,
ADD COLUMN "sketchStorageKey" TEXT,
ADD COLUMN "sketchMimeType" TEXT;
