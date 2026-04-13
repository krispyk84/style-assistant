-- Add imageData column to UploadedImage so uploaded photos survive Render restarts
ALTER TABLE "UploadedImage" ADD COLUMN "imageData" BYTEA;

-- Null out expired fal.ai sketch URLs on ClosetItem; these CDN URLs have expired
-- and cannot be recovered — clearing them removes the broken image references
UPDATE "ClosetItem"
SET "sketchImageUrl" = NULL
WHERE "sketchImageUrl" LIKE '%fal.media%'
   OR "sketchImageUrl" LIKE '%fal.run%';
