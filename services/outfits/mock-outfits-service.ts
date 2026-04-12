import { buildMockLookResponse, getSampleLookResponse } from '@/lib/look-mock-data';
import type { ApiResponse, GenerateOutfitsRequest, GenerateOutfitsResponse, OutfitHistoryResponse } from '@/types/api';
import type { OutfitsService } from '@/services/outfits/outfits-service';

export const mockOutfitsService: OutfitsService = {
  async generateOutfits(request: GenerateOutfitsRequest, _options?: { signal?: AbortSignal }): Promise<ApiResponse<GenerateOutfitsResponse>> {
    return {
      success: true,
      data: buildMockLookResponse(request, request.requestId, request.variantMap),
      error: null,
    };
  },

  async regenerateTier(requestId, tier): Promise<ApiResponse<GenerateOutfitsResponse>> {
    const sample = getSampleLookResponse(requestId);

    if (!sample) {
      return {
        success: false,
        data: null,
        error: {
          code: 'OUTFIT_NOT_FOUND',
          message: 'No mocked outfit result exists for that request id.',
        },
      };
    }

    return {
      success: true,
      data: buildMockLookResponse(
        sample.input,
        sample.requestId,
        {
          [tier]: 1,
        }
      ),
      error: null,
    };
  },

  async getOutfitHistory(_params?: { page?: number; limit?: number }): Promise<ApiResponse<OutfitHistoryResponse>> {
    return { success: true, data: { items: [], total: 0, page: 1, hasMore: false }, error: null };
  },

  async deleteOutfitFromHistory(_requestId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return { success: true, data: { deleted: true }, error: null };
  },

  async getOutfitResult(requestId: string): Promise<ApiResponse<GenerateOutfitsResponse>> {
    const sample = getSampleLookResponse(requestId);

    if (!sample) {
      return {
        success: false,
        data: null,
        error: {
          code: 'OUTFIT_NOT_FOUND',
          message: 'No mocked outfit result exists for that request id.',
        },
      };
    }

    return {
      success: true,
      data: sample,
      error: null,
    };
  },
};
