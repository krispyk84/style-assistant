import { selfieMockAnalyses } from '@/lib/image-analysis-mock';
import type { ApiResponse, SelfieReviewRequest, SelfieReviewResponse } from '@/types/api';
import type { SelfieReviewService } from '@/services/selfie-review/selfie-review-service';

export const mockSelfieReviewService: SelfieReviewService = {
  async analyzeSelfie(request: SelfieReviewRequest): Promise<ApiResponse<SelfieReviewResponse>> {
    const index = request.image.uri.length % selfieMockAnalyses.length;

    return {
      success: true,
      data: selfieMockAnalyses[index],
      error: null,
    };
  },
};
