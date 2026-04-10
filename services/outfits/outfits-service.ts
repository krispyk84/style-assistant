import type { ApiResponse, GenerateOutfitsRequest, GenerateOutfitsResponse, OutfitHistoryResponse } from '@/types/api';

export type OutfitsService = {
  generateOutfits: (request: GenerateOutfitsRequest, options?: { signal?: AbortSignal }) => Promise<ApiResponse<GenerateOutfitsResponse>>;
  regenerateTier: (
    requestId: string,
    tier: GenerateOutfitsRequest['selectedTiers'][number]
  ) => Promise<ApiResponse<GenerateOutfitsResponse>>;
  getOutfitHistory: () => Promise<ApiResponse<OutfitHistoryResponse>>;
  getOutfitResult: (requestId: string) => Promise<ApiResponse<GenerateOutfitsResponse>>;
};
