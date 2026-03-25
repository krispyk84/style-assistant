-- CreateTable
CREATE TABLE "ClosetItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT '',
    "size" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'Clothing',
    "uploadedImageUrl" TEXT,
    "sketchImageUrl" TEXT,
    "sketchStorageKey" TEXT,
    "sketchMimeType" TEXT,
    "sketchImageData" BYTEA,
    "sketchStatus" TEXT NOT NULL DEFAULT 'failed',
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClosetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClosetSketchJob" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sketchImageUrl" TEXT,
    "sketchStorageKey" TEXT,
    "sketchMimeType" TEXT,
    "sketchImageData" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClosetSketchJob_pkey" PRIMARY KEY ("id")
);
