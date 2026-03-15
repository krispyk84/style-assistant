import { candidatePieceMockAnalyses } from '@/lib/image-analysis-mock';
import type { ApiResponse, CompatibilityCheckRequest, CompatibilityCheckResponse } from '@/types/api';
import type { CompatibilityService } from '@/services/compatibility/compatibility-service';

export const mockCompatibilityService: CompatibilityService = {
  async analyzePiece(request: CompatibilityCheckRequest): Promise<ApiResponse<CompatibilityCheckResponse>> {
    const index = request.image.uri.length % candidatePieceMockAnalyses.length;

    return {
      success: true,
      data: candidatePieceMockAnalyses[index],
      error: null,
    };
  },
};
