-- CreateEnum
CREATE TYPE "UploadedImageCategory" AS ENUM ('ANCHOR_ITEM', 'CANDIDATE_PIECE', 'SELFIE');

-- AlterTable
ALTER TABLE "CompatibilityCheck" ADD COLUMN     "imageHeight" INTEGER,
ADD COLUMN     "imageId" TEXT,
ADD COLUMN     "imageKey" TEXT,
ADD COLUMN     "imageMimeType" TEXT,
ADD COLUMN     "imageSizeBytes" INTEGER,
ADD COLUMN     "imageWidth" INTEGER;

-- AlterTable
ALTER TABLE "OutfitRequest" ADD COLUMN     "anchorImageId" TEXT;

-- AlterTable
ALTER TABLE "SelfieReview" ADD COLUMN     "imageHeight" INTEGER,
ADD COLUMN     "imageId" TEXT,
ADD COLUMN     "imageKey" TEXT,
ADD COLUMN     "imageMimeType" TEXT,
ADD COLUMN     "imageSizeBytes" INTEGER,
ADD COLUMN     "imageWidth" INTEGER;

-- CreateTable
CREATE TABLE "UploadedImage" (
    "id" TEXT NOT NULL,
    "category" "UploadedImageCategory" NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "originalFilename" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadedImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UploadedImage_storageKey_key" ON "UploadedImage"("storageKey");

-- AddForeignKey
ALTER TABLE "OutfitRequest" ADD CONSTRAINT "OutfitRequest_anchorImageId_fkey" FOREIGN KEY ("anchorImageId") REFERENCES "UploadedImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompatibilityCheck" ADD CONSTRAINT "CompatibilityCheck_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "UploadedImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelfieReview" ADD CONSTRAINT "SelfieReview_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "UploadedImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
