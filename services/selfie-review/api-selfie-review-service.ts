import { createApiClient } from '@/lib/api/api-client';
import type { SelfieReviewService } from '@/services/selfie-review/selfie-review-service';

export const apiSelfieReviewService: SelfieReviewService = {
  analyzeSelfie(request) {
    return createApiClient().request('/selfie-review', {
      method: 'POST',
      body: {
        imageId: request.uploadedImage?.id,
        imageUrl: request.uploadedImage?.publicUrl ?? request.image.uri,
        imageFilename: request.uploadedImage?.originalFilename ?? request.image.fileName,
        requestId: request.requestId,
        tier: request.tier,
        outfitTitle: request.outfitTitle,
        anchorItemDescription: request.anchorItemDescription,
      },
    });
  },
};
