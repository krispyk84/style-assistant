import { createApiClient } from '@/lib/api/api-client';
import type { CompatibilityService } from '@/services/compatibility/compatibility-service';

export const apiCompatibilityService: CompatibilityService = {
  analyzePiece(request) {
    return createApiClient().request('/compatibility-check', {
      method: 'POST',
      body: {
        imageId: request.uploadedImage?.id,
        imageUrl: request.uploadedImage?.publicUrl ?? request.image.uri,
        imageFilename: request.uploadedImage?.originalFilename ?? request.image.fileName,
        requestId: request.requestId,
        tier: request.tier,
        outfitTitle: request.outfitTitle,
        anchorItemDescription: request.anchorItemDescription,
        pieceName: request.pieceName,
        candidateItemDescription: request.candidateItemDescription,
      },
    });
  },
};
