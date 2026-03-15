import { buildMockLookResponse, getSampleLookResponse } from '@/lib/look-mock-data';
import { outfitResults } from '@/lib/mock-data';
import type { ApiResponse, GenerateOutfitsRequest, GenerateOutfitsResponse, OutfitHistoryResponse } from '@/types/api';
import type { OutfitsService } from '@/services/outfits/outfits-service';

export const mockOutfitsService: OutfitsService = {
  async generateOutfits(request: GenerateOutfitsRequest): Promise<ApiResponse<GenerateOutfitsResponse>> {
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

  async getOutfitHistory(): Promise<ApiResponse<OutfitHistoryResponse>> {
    return {
      success: true,
      data: { items: outfitResults },
      error: null,
    };
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
