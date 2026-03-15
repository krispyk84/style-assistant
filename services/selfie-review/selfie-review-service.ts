import type { ApiResponse, SelfieReviewRequest, SelfieReviewResponse } from '@/types/api';

export type SelfieReviewService = {
  analyzeSelfie: (request: SelfieReviewRequest) => Promise<ApiResponse<SelfieReviewResponse>>;
};
