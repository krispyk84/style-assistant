import { AnalysisVerdict, Prisma } from '@prisma/client';

import { prisma } from '../../db/prisma.js';
import type { AnalysisResponse } from '../../contracts/analysis.contracts.js';

function toPrismaVerdict(verdict: AnalysisResponse['verdict']): AnalysisVerdict {
  if (verdict === 'Works great') return AnalysisVerdict.WORKS_GREAT;
  if (verdict === 'Works okay') return AnalysisVerdict.WORKS_OKAY;
  return AnalysisVerdict.DOESNT_WORK;
}

export const compatibilityRepository = {
  async create(input: {
    profileId?: string;
    imageId?: string;
    imageUrl?: string;
    imageKey?: string;
    imageFilename?: string;
    imageMimeType?: string;
    imageWidth?: number;
    imageHeight?: number;
    imageSizeBytes?: number;
    output: AnalysisResponse;
  }) {
    const db = prisma as any;
    return db.compatibilityCheck.create({
      data: {
        profileId: input.profileId,
        imageId: input.imageId,
        imageUrl: input.imageUrl,
        imageKey: input.imageKey,
        imageFilename: input.imageFilename,
        imageMimeType: input.imageMimeType,
        imageWidth: input.imageWidth,
        imageHeight: input.imageHeight,
        imageSizeBytes: input.imageSizeBytes,
        verdict: toPrismaVerdict(input.output.verdict),
        stylistNotes: input.output.stylistNotes,
        suggestedChanges: input.output.suggestedChanges,
        rawResponse: input.output as unknown as Prisma.JsonObject,
      },
    });
  },
};
