-- Add design metadata and personal fit fields to ClosetItem
ALTER TABLE "ClosetItem" ADD COLUMN "subcategory" TEXT;
ALTER TABLE "ClosetItem" ADD COLUMN "primaryColor" TEXT;
ALTER TABLE "ClosetItem" ADD COLUMN "colorFamily" TEXT;
ALTER TABLE "ClosetItem" ADD COLUMN "material" TEXT;
ALTER TABLE "ClosetItem" ADD COLUMN "formality" TEXT;
ALTER TABLE "ClosetItem" ADD COLUMN "silhouette" TEXT;
ALTER TABLE "ClosetItem" ADD COLUMN "season" TEXT;
ALTER TABLE "ClosetItem" ADD COLUMN "weight" TEXT;
ALTER TABLE "ClosetItem" ADD COLUMN "pattern" TEXT;
ALTER TABLE "ClosetItem" ADD COLUMN "notes" TEXT;
ALTER TABLE "ClosetItem" ADD COLUMN "fitStatus" TEXT;
