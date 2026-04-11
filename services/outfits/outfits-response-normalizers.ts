import type { GenerateOutfitsResponse } from '@/types/api';
import type { LookAnchorItem } from '@/types/look-request';

type RawAnchorItem = {
  description?: string;
  imageId?: string;
  imageUrl?: string;
};

// The API may return legacy flat fields (anchorImageUrl/anchorImageId) alongside the
// structured anchorItems array. We read them here for backwards-compat normalization.
type LegacyOutfitInput = { anchorImageUrl?: string | null; anchorImageId?: string | null };

function buildUploadedAnchorImage(id: string, imageUrl: string) {
  return {
    id,
    category: 'anchor-item' as const,
    storageProvider: 'local' as const,
    storageKey: '',
    publicUrl: imageUrl,
    originalFilename: null,
    mimeType: null,
    sizeBytes: null,
    width: null,
    height: null,
    createdAt: new Date().toISOString(),
  };
}

export function normalizeAnchorItems(response: GenerateOutfitsResponse): LookAnchorItem[] {
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
          ? buildUploadedAnchorImage(item.imageId, item.imageUrl)
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

export function normalizeOutfitResponse(response: GenerateOutfitsResponse): GenerateOutfitsResponse {
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
          ? buildUploadedAnchorImage(anchorImageId, anchorImageUrl)
          : null),
    },
  };
}
