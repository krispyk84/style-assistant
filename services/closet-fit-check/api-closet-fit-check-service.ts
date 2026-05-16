import { createApiClient } from '@/lib/api/api-client';
import type { ApiResponse, ClosetFitCheckRequest, ClosetFitCheckResponse } from '@/types/api';
import type { ClosetFitCheckService } from './closet-fit-check-service';

export const apiClosetFitCheckService: ClosetFitCheckService = {
  async evaluate(request: ClosetFitCheckRequest): Promise<ApiResponse<ClosetFitCheckResponse>> {
    return createApiClient().request<ClosetFitCheckResponse>('/closet/fit-check', {
      method: 'POST',
      body: {
        uploadedImageId: request.uploadedImageId,
        uploadedImageUrl: request.uploadedImageUrl,
        notes: request.notes?.trim() || undefined,
        trendiness: request.trendiness,
      },
    });
  },
};
