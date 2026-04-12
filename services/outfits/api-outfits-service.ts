import { createApiClient } from '@/lib/api/api-client';
import { mockOutfitsService } from '@/services/outfits/mock-outfits-service';
import type { OutfitsService } from '@/services/outfits/outfits-service';
import type { GenerateOutfitsResponse, OutfitHistoryResponse } from '@/types/api';
import { normalizeOutfitResponse } from './outfits-response-normalizers';

// Future OpenAI-backed outfit generation responses will be normalized here.
export const apiOutfitsService: OutfitsService = {
  async generateOutfits(request, options) {
    const response = await createApiClient().request<GenerateOutfitsResponse>('/outfits/generate', {
      method: 'POST',
      signal: options?.signal,
      body: {
        requestId: request.requestId,
        anchorItems: request.anchorItems.map((item) => ({
          description: item.description,
          fitStatus: item.fitStatus,
          // Closet-ref items are URL-only references, not DB uploads — skip imageId to avoid FK violations
          imageId: item.uploadedImage?.storageProvider === 'closet-ref' ? undefined : item.uploadedImage?.id,
          imageUrl: item.uploadedImage?.publicUrl,
        })),
        anchorItemDescription: request.anchorItemDescription,
        vibeKeywords: request.vibeKeywords?.trim() || undefined,
        anchorImageId: request.uploadedAnchorImage?.storageProvider === 'closet-ref' ? undefined : request.uploadedAnchorImage?.id,
        anchorImageUrl: request.uploadedAnchorImage?.publicUrl,
        photoPending: request.photoPending,
        selectedTiers: request.selectedTiers,
        generateOnlyTier: request.generateOnlyTier,
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

  async getOutfitHistory(params?: { page?: number; limit?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 5;
    const response = await createApiClient().request<OutfitHistoryResponse>(
      `/outfits/history?page=${page}&limit=${limit}`
    );

    if (response.success && response.data) {
      return {
        ...response,
        data: {
          items: response.data.items.map(normalizeOutfitResponse),
          total: response.data.total,
          page: response.data.page,
          hasMore: response.data.hasMore,
        },
      };
    }

    if (response.error?.code === 'HTTP_ERROR' || response.error?.code === 'NETWORK_ERROR' || response.error?.code === 'NOT_FOUND') {
      return mockOutfitsService.getOutfitHistory(params);
    }

    return response;
  },

  async deleteOutfitFromHistory(requestId: string) {
    return createApiClient().request<{ deleted: boolean }>(`/outfits/${requestId}`, {
      method: 'DELETE',
    });
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
