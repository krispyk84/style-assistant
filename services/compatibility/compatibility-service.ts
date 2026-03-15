import type { ApiResponse, CompatibilityCheckRequest, CompatibilityCheckResponse } from '@/types/api';

export type CompatibilityService = {
  analyzePiece: (request: CompatibilityCheckRequest) => Promise<ApiResponse<CompatibilityCheckResponse>>;
};
