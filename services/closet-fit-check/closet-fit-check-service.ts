import type { ApiResponse, ClosetFitCheckRequest, ClosetFitCheckResponse } from '@/types/api';

export type ClosetFitCheckService = {
  evaluate: (request: ClosetFitCheckRequest) => Promise<ApiResponse<ClosetFitCheckResponse>>;
};
