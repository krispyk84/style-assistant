import { Prisma } from '@prisma/client';

import { prisma } from '../../db/prisma.js';

export const styleGuideRepository = {
  async findActive() {
    const db = prisma as any;

    return db.styleGuideDocument.findFirst({
      where: { active: true },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  },

  async replaceActive(input: {
    name: string;
    sourceFilename: string;
    sourceMimeType?: string;
    sourcePath?: string;
    processedTextPath?: string;
    openAiFileId?: string;
    vectorStoreId: string;
    metadata?: Record<string, unknown>;
  }) {
    const db = prisma as any;

    return prisma.$transaction(async (tx) => {
      const transactionDb = tx as any;

      await transactionDb.styleGuideDocument.updateMany({
        where: { active: true },
        data: { active: false },
      });

      return transactionDb.styleGuideDocument.create({
        data: {
          name: input.name,
          sourceFilename: input.sourceFilename,
          sourceMimeType: input.sourceMimeType ?? null,
          sourcePath: input.sourcePath ?? null,
          processedTextPath: input.processedTextPath ?? null,
          openAiFileId: input.openAiFileId ?? null,
          vectorStoreId: input.vectorStoreId,
          metadata: (input.metadata ?? null) as Prisma.JsonObject | null,
          status: 'ready',
          active: true,
        },
      });
    });
  },
};
