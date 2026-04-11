import type { Href } from 'expo-router';

import type { CreateLookInput, LookRecommendation } from '@/types/look-request';
import { type LookTierSlug, LOOK_TIER_OPTIONS } from '@/types/look-request';
import type { LookRouteParams } from './look-route-params';
import {
  encodeList,
  encodePieceList,
  serializeAnchorItems,
  parseAnchorItems,
  parseUploadedAnchorImage,
  parseWeatherContext,
} from './look-route-serializers';

export type { LookRouteParams };
export { parseLookRecommendation } from './look-route-serializers';

export function parseLookInput(params: LookRouteParams): CreateLookInput | null {
  const selectedTiers = (params.tiers?.split(',') ?? []).filter((tier): tier is LookTierSlug =>
    LOOK_TIER_OPTIONS.includes(tier as LookTierSlug)
  );

  if (!selectedTiers.length) {
    return null;
  }

  const anchorItems = parseAnchorItems(params);
  const primaryAnchorItem = anchorItems[0] ?? null;

  return {
    anchorItems,
    anchorItemDescription:
      params.anchorItemDescription ??
      anchorItems
        .map((item) => item.description.trim())
        .filter(Boolean)
        .join(' • '),
    vibeKeywords: params.vibeKeywords ?? '',
    photoPending: params.photoPending === 'true',
    selectedTiers,
    weatherContext: parseWeatherContext(params),
    uploadedAnchorImage: primaryAnchorItem?.uploadedImage ?? parseUploadedAnchorImage(params),
    anchorImage: primaryAnchorItem?.image ?? null,
  };
}

export function buildLookRouteParams(requestId: string, input: CreateLookInput) {
  return {
    requestId,
    anchorItems: serializeAnchorItems(input.anchorItems),
    anchorItemDescription: input.anchorItemDescription,
    vibeKeywords: input.vibeKeywords,
    photoPending: String(input.photoPending),
    tiers: input.selectedTiers.join(','),
    anchorImageUri: input.anchorImage?.uri,
    anchorImageWidth: input.anchorImage?.width ? String(input.anchorImage.width) : undefined,
    anchorImageHeight: input.anchorImage?.height ? String(input.anchorImage.height) : undefined,
    anchorImageFileName: input.anchorImage?.fileName ?? undefined,
    anchorImageMimeType: input.anchorImage?.mimeType ?? undefined,
    uploadedAnchorImageId: input.uploadedAnchorImage?.id,
    uploadedAnchorImageCategory: input.uploadedAnchorImage?.category,
    uploadedAnchorImageStorageProvider: input.uploadedAnchorImage?.storageProvider,
    uploadedAnchorImageStorageKey: input.uploadedAnchorImage?.storageKey,
    uploadedAnchorImagePublicUrl: input.uploadedAnchorImage?.publicUrl,
    uploadedAnchorImageOriginalFilename: input.uploadedAnchorImage?.originalFilename ?? undefined,
    uploadedAnchorImageSizeBytes: input.uploadedAnchorImage?.sizeBytes ? String(input.uploadedAnchorImage.sizeBytes) : undefined,
    weatherTemperatureC: input.weatherContext ? String(input.weatherContext.temperatureC) : undefined,
    weatherApparentTemperatureC: input.weatherContext ? String(input.weatherContext.apparentTemperatureC) : undefined,
    weatherCode: input.weatherContext ? String(input.weatherContext.weatherCode) : undefined,
    weatherSeason: input.weatherContext?.season,
    weatherSummary: input.weatherContext?.summary,
    weatherStylingHint: input.weatherContext?.stylingHint,
    weatherLocationLabel: input.weatherContext?.locationLabel ?? undefined,
    weatherFetchedAt: input.weatherContext?.fetchedAt,
  };
}

export function buildTierHref(
  tier: LookTierSlug,
  requestId: string,
  input: CreateLookInput,
  recommendation: LookRecommendation
): Href {
  return {
    pathname: '/tier/[tier]',
    params: {
      tier,
      ...buildLookRouteParams(requestId, input),
      recommendationTitle: recommendation.title,
      recommendationAnchorItem: recommendation.anchorItem,
      recommendationKeyPieces: encodePieceList(recommendation.keyPieces),
      recommendationShoes: encodePieceList(recommendation.shoes),
      recommendationAccessories: encodePieceList(recommendation.accessories),
      recommendationFitNotes: encodeList(recommendation.fitNotes),
      recommendationWhyItWorks: recommendation.whyItWorks,
      recommendationStylingDirection: recommendation.stylingDirection,
      recommendationDetailNotes: encodeList(recommendation.detailNotes),
      recommendationSketchStatus: recommendation.sketchStatus,
      recommendationSketchImageUrl: recommendation.sketchImageUrl ?? undefined,
      recommendationSketchStorageKey: recommendation.sketchStorageKey ?? undefined,
      recommendationSketchMimeType: recommendation.sketchMimeType ?? undefined,
    },
  };
}

export function buildLookResultsHref(requestId: string, input: CreateLookInput): Href {
  return {
    pathname: '/results/[requestId]',
    params: buildLookRouteParams(requestId, input),
  };
}
