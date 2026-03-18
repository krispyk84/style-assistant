import { createApiClient } from '@/lib/api/api-client';
import { mockOutfitsService } from '@/services/outfits/mock-outfits-service';
import type { OutfitsService } from '@/services/outfits/outfits-service';
import type { GenerateOutfitsResponse, OutfitHistoryResponse } from '@/types/api';

function normalizeOutfitResponse(response: GenerateOutfitsResponse): GenerateOutfitsResponse {
  const anchorImageUrl = (response as any)?.input?.anchorImageUrl as string | null | undefined;
  const anchorImageId = (response as any)?.input?.anchorImageId as string | null | undefined;

  return {
    ...response,
    input: {
      ...response.input,
      anchorImage:
        response.input.anchorImage ??
        (anchorImageUrl
          ? {
              uri: anchorImageUrl,
              fileName: undefined,
              mimeType: undefined,
              width: undefined,
              height: undefined,
            }
          : null),
      uploadedAnchorImage:
        response.input.uploadedAnchorImage ??
        (anchorImageUrl && anchorImageId
          ? {
              id: anchorImageId,
              category: 'anchor-item',
              storageProvider: 'local',
              storageKey: '',
              publicUrl: anchorImageUrl,
              originalFilename: null,
              mimeType: null,
              sizeBytes: null,
              width: null,
              height: null,
              createdAt: new Date().toISOString(),
            }
          : null),
    },
  };
}

// Future OpenAI-backed outfit generation responses will be normalized here.
export const apiOutfitsService: OutfitsService = {
  async generateOutfits(request) {
    const response = await createApiClient().request<GenerateOutfitsResponse>('/outfits/generate', {
      method: 'POST',
      body: {
        requestId: request.requestId,
        anchorItemDescription: request.anchorItemDescription,
        anchorImageId: request.uploadedAnchorImage?.id,
        anchorImageUrl: request.uploadedAnchorImage?.publicUrl,
        photoPending: request.photoPending,
        selectedTiers: request.selectedTiers,
        weatherContext: request.weatherContext ?? null,
      },
    });

    return response.success && response.data
      ? { ...response, data: normalizeOutfitResponse(response.data) }
      : response;
  },

  async regenerateTier(requestId, tier) {
    const response = await createApiClient().request<GenerateOutfitsResponse>(`/outfits/${requestId}/regenerate-tier`, {
      method: 'POST',
      body: { tier },
    });

    return response.success && response.data
      ? { ...response, data: normalizeOutfitResponse(response.data) }
      : response;
  },

  async getOutfitHistory() {
    const response = await createApiClient().request<OutfitHistoryResponse>('/outfits/history');

    if (response.success) {
      return response;
    }

    if (response.error?.code === 'HTTP_ERROR' || response.error?.code === 'NETWORK_ERROR' || response.error?.code === 'NOT_FOUND') {
      return mockOutfitsService.getOutfitHistory();
    }

    return response;
  },

  async getOutfitResult(requestId) {
    const response = await createApiClient().request<GenerateOutfitsResponse>(`/outfits/${requestId}`);

    if (response.success && response.data) {
      return { ...response, data: normalizeOutfitResponse(response.data) };
    }

    if (response.error?.code === 'HTTP_ERROR' || response.error?.code === 'NETWORK_ERROR' || response.error?.code === 'NOT_FOUND') {
      return mockOutfitsService.getOutfitResult(requestId);
    }

    return response;
  },
};
