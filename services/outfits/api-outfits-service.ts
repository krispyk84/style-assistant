import { createApiClient } from '@/lib/api/api-client';
import { mockOutfitsService } from '@/services/outfits/mock-outfits-service';
import type { OutfitsService } from '@/services/outfits/outfits-service';
import type { GenerateOutfitsResponse, OutfitHistoryResponse } from '@/types/api';
import type { LookAnchorItem } from '@/types/look-request';

type RawAnchorItem = {
  description?: string;
  imageId?: string;
  imageUrl?: string;
};

function normalizeAnchorItems(response: GenerateOutfitsResponse): LookAnchorItem[] {
  const rawAnchorItems = (Array.isArray(response.input.anchorItems) ? response.input.anchorItems : []) as RawAnchorItem[];

  if (rawAnchorItems.length) {
    return rawAnchorItems.map((item, index) => ({
      id: `anchor-${index + 1}`,
      description: item.description ?? '',
      image: item.imageUrl
        ? {
            uri: item.imageUrl,
            fileName: undefined,
            mimeType: undefined,
            width: undefined,
            height: undefined,
          }
        : null,
      uploadedImage:
        item.imageId && item.imageUrl
          ? {
              id: item.imageId,
              category: 'anchor-item',
              storageProvider: 'local',
              storageKey: '',
              publicUrl: item.imageUrl,
              originalFilename: null,
              mimeType: null,
              sizeBytes: null,
              width: null,
              height: null,
              createdAt: new Date().toISOString(),
            }
          : null,
    }));
  }

  return [
    {
      id: 'anchor-primary',
      description: response.input.anchorItemDescription,
      image: response.input.anchorImage,
      uploadedImage: response.input.uploadedAnchorImage,
    },
  ].filter((item) => item.description.trim() || item.image || item.uploadedImage);
}

// The API may return legacy flat fields (anchorImageUrl/anchorImageId) alongside the
// structured anchorItems array. We read them here for backwards-compat normalization.
type LegacyOutfitInput = { anchorImageUrl?: string | null; anchorImageId?: string | null };

function normalizeOutfitResponse(response: GenerateOutfitsResponse): GenerateOutfitsResponse {
  const legacyInput = response.input as GenerateOutfitsResponse['input'] & LegacyOutfitInput;
  const anchorImageUrl = legacyInput.anchorImageUrl;
  const anchorImageId = legacyInput.anchorImageId;
  const anchorItems = normalizeAnchorItems(response);

  return {
    ...response,
    input: {
      ...response.input,
      anchorItems,
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

  async getOutfitHistory() {
    const response = await createApiClient().request<OutfitHistoryResponse>('/outfits/history');

    if (response.success && response.data) {
      return {
        ...response,
        data: { items: response.data.items.map(normalizeOutfitResponse) },
      };
    }

    if (response.error?.code === 'HTTP_ERROR' || response.error?.code === 'NETWORK_ERROR' || response.error?.code === 'NOT_FOUND') {
      return mockOutfitsService.getOutfitHistory();
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
