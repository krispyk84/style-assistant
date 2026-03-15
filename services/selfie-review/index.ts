import { canUseRealApi } from '@/lib/api/api-client';
import { apiSelfieReviewService } from '@/services/selfie-review/api-selfie-review-service';
import { mockSelfieReviewService } from '@/services/selfie-review/mock-selfie-review-service';

export const selfieReviewService = canUseRealApi() ? apiSelfieReviewService : mockSelfieReviewService;
