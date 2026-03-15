-- CreateTable
CREATE TABLE "StyleGuideDocument" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceFilename" TEXT NOT NULL,
    "sourceMimeType" TEXT,
    "sourcePath" TEXT,
    "processedTextPath" TEXT,
    "openAiFileId" TEXT,
    "vectorStoreId" TEXT NOT NULL,
    "retrievalProvider" TEXT NOT NULL DEFAULT 'openai',
    "status" TEXT NOT NULL DEFAULT 'ready',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StyleGuideDocument_pkey" PRIMARY KEY ("id")
);
