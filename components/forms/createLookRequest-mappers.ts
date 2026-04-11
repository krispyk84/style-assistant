import { buildLookRouteParams } from '@/lib/look-route';
import { createMockRequestId } from '@/lib/look-mock-data';
import type { CreateLookInput, LookAnchorItem, LookTierSlug } from '@/types/look-request';
import type { WeatherContext } from '@/types/weather';

export function createEmptyAnchorItem(): LookAnchorItem {
  return {
    id: `anchor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: '',
    image: null,
    uploadedImage: null,
  };
}

export function buildInitialAnchorItems(initialValue: CreateLookInput): LookAnchorItem[] {
  if (initialValue.anchorItems.length) {
    return initialValue.anchorItems;
  }

  if (initialValue.anchorItemDescription || initialValue.anchorImage || initialValue.uploadedAnchorImage) {
    return [
      {
        id: 'anchor-initial',
        description: initialValue.anchorItemDescription,
        image: initialValue.anchorImage,
        uploadedImage: initialValue.uploadedAnchorImage,
      },
    ];
  }

  return [createEmptyAnchorItem()];
}

export function buildSubmitRouteParams(params: {
  populatedAnchorItems: LookAnchorItem[];
  vibeKeywords: string;
  selectedTiers: LookTierSlug[];
  shouldAddAnchorToCloset: boolean;
  weatherContext: WeatherContext | null;
}) {
  const { populatedAnchorItems, vibeKeywords, selectedTiers, shouldAddAnchorToCloset, weatherContext } = params;
  const requestId = createMockRequestId();
  const primaryAnchorItem = populatedAnchorItems[0];
  const anchorItemDescription = populatedAnchorItems
    .map((item) => item.description.trim())
    .filter(Boolean)
    .join(' • ');

  return {
    ...buildLookRouteParams(requestId, {
      anchorItems: populatedAnchorItems,
      anchorItemDescription,
      vibeKeywords: vibeKeywords.trim(),
      anchorImage: primaryAnchorItem?.image ?? null,
      uploadedAnchorImage: primaryAnchorItem?.uploadedImage ?? null,
      photoPending: !populatedAnchorItems.some((item) => item.image || item.uploadedImage),
      selectedTiers,
      weatherContext,
    }),
    addAnchorToCloset: shouldAddAnchorToCloset ? 'true' : undefined,
  };
}
