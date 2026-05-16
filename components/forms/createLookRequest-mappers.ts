import { buildLookRouteParams } from '@/lib/look-route';
import { createMockRequestId } from '@/lib/look-mock-data';
import type { ClosetItemFitStatus } from '@/types/closet';
import type { CreateLookInput, LookAnchorItem, LookTierSlug } from '@/types/look-request';
import type { WeatherContext, WeatherSeason } from '@/types/weather';

/**
 * Build the initial anchor items list when entering the create-look form
 * from a closet item (e.g. the closet's "Build a look around this" action).
 * Returns an empty array when no closet item params are present so the form
 * can fall through to its empty-state initial item.
 */
export function buildAnchorItemsFromClosetParams(params: {
  closetItemId?: string;
  closetItemTitle?: string;
  closetItemImageUrl?: string;
  closetItemFitStatus?: string;
}): LookAnchorItem[] {
  const { closetItemId, closetItemTitle, closetItemImageUrl, closetItemFitStatus } = params;
  if (!closetItemId || !closetItemTitle || !closetItemImageUrl) return [];
  return [
    {
      id: closetItemId,
      description: closetItemTitle,
      image: null,
      fitStatus: closetItemFitStatus as ClosetItemFitStatus | undefined,
      uploadedImage: {
        id: closetItemId,
        category: 'anchor-item' as const,
        storageProvider: 'closet-ref',
        storageKey: closetItemImageUrl,
        publicUrl: closetItemImageUrl,
        createdAt: new Date().toISOString(),
      },
    },
  ];
}

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
  manualSeason: WeatherSeason | null;
  includeBag: boolean;
  includeHat: boolean;
  additionalDetails: string;
  /** 1-3 — only honoured when selectedTiers.length === 1; otherwise treated as 1. */
  lookCount: number;
}) {
  const { populatedAnchorItems, vibeKeywords, selectedTiers, shouldAddAnchorToCloset, weatherContext, manualSeason, includeBag, includeHat, additionalDetails, lookCount } = params;

  const SEASON_HINT: Record<WeatherSeason, string> = {
    spring: 'Mild transitional weather — light layers appropriate.',
    summer: 'Hot weather — lightweight breathable pieces appropriate.',
    fall:   'Cooler transitional weather — medium layers appropriate.',
    winter: 'Cold weather — warm layering and heavier fabrics appropriate.',
  };

  // Apply manual season override: patch existing context or create a synthetic one.
  // parseWeatherContext requires non-empty summary and stylingHint to reconstruct from URL params.
  const effectiveWeatherContext: WeatherContext | null = manualSeason
    ? weatherContext
      ? { ...weatherContext, season: manualSeason }
      : {
          temperatureC: 20,
          apparentTemperatureC: 20,
          dailyHighC: null,
          dailyLowC: null,
          weatherCode: 0,
          season: manualSeason,
          summary: manualSeason.charAt(0).toUpperCase() + manualSeason.slice(1),
          stylingHint: SEASON_HINT[manualSeason],
          locationLabel: null,
          fetchedAt: new Date().toISOString(),
        }
    : weatherContext;
  const requestId = createMockRequestId();
  const primaryAnchorItem = populatedAnchorItems[0];

  // Same-tier multi-look: generate distinct child requestIds (variation 2..N) so each
  // variation is persisted independently. Only honoured when exactly one tier is selected.
  const effectiveLookCount = selectedTiers.length === 1 ? Math.max(1, Math.min(3, lookCount)) : 1;
  const variantRequestIds: string[] = [];
  for (let i = 1; i < effectiveLookCount; i += 1) {
    variantRequestIds.push(`${requestId}-v${i + 1}`);
  }
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
      weatherContext: effectiveWeatherContext,
      manualSeason,
      includeBag,
      includeHat,
      additionalDetails,
    }),
    addAnchorToCloset: shouldAddAnchorToCloset ? 'true' : undefined,
    lookCount: effectiveLookCount > 1 ? String(effectiveLookCount) : undefined,
    variantRequestIds: variantRequestIds.length ? variantRequestIds.join(',') : undefined,
  };
}
