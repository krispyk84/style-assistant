-- Add sunglasses-specific metadata fields to ClosetItem
ALTER TABLE "ClosetItem" ADD COLUMN "lensShape" TEXT;
ALTER TABLE "ClosetItem" ADD COLUMN "frameColor" TEXT;
