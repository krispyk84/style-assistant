import type { Href } from 'expo-router';

import type { CreateLookInput, LookAnchorItem, LookRecommendation, OutfitPiece } from '@/types/look-request';
import type { ClosetItemFitStatus } from '@/types/closet';
import type { LocalImageAsset, UploadedImageAsset } from '@/types/media';
import type { WeatherContext, WeatherSeason } from '@/types/weather';
import { LOOK_TIER_OPTIONS, normalizePiece, type LookTierSlug } from '@/types/look-request';
import type { LookRouteParams } from './look-route-params';

export type { LookRouteParams };

type SerializedAnchorItem = {
  id: string;
  description: string;
  fitStatus?: string;
  anchorImageUri?: string;
  anchorImageWidth?: string;
  anchorImageHeight?: string;
  anchorImageFileName?: string;
  anchorImageMimeType?: string;
  uploadedAnchorImageId?: string;
  uploadedAnchorImageCategory?: string;
  uploadedAnchorImageStorageProvider?: string;
  uploadedAnchorImageStorageKey?: string;
  uploadedAnchorImagePublicUrl?: string;
  uploadedAnchorImageOriginalFilename?: string;
  uploadedAnchorImageSizeBytes?: string;
};

function encodeList(values: string[]) {
  return JSON.stringify(values);
}

function decodeList(value?: string) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function encodePieceList(pieces: OutfitPiece[]): string {
  return JSON.stringify(pieces);
}

function decodePieceList(value?: string): OutfitPiece[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: unknown) =>
      typeof item === 'string'
        ? normalizePiece(item)
        : normalizePiece(item as OutfitPiece | string)
    );
  } catch {
    return [];
  }
}

function parseUploadedAnchorImage(params: LookRouteParams): UploadedImageAsset | null {
  if (!params.uploadedAnchorImageId || !params.uploadedAnchorImagePublicUrl || !params.uploadedAnchorImageStorageKey) {
    return null;
  }

  return {
    id: params.uploadedAnchorImageId,
    category: (params.uploadedAnchorImageCategory as UploadedImageAsset['category']) ?? 'anchor-item',
    storageProvider: params.uploadedAnchorImageStorageProvider ?? 'local',
    storageKey: params.uploadedAnchorImageStorageKey,
    publicUrl: params.uploadedAnchorImagePublicUrl,
    originalFilename: params.uploadedAnchorImageOriginalFilename ?? null,
    mimeType: params.anchorImageMimeType ?? null,
    sizeBytes: params.uploadedAnchorImageSizeBytes ? Number(params.uploadedAnchorImageSizeBytes) : null,
    width: params.anchorImageWidth ? Number(params.anchorImageWidth) : null,
    height: params.anchorImageHeight ? Number(params.anchorImageHeight) : null,
    createdAt: new Date().toISOString(),
  };
}

function parseSerializedAnchorItem(item: SerializedAnchorItem): LookAnchorItem {
  return {
    id: item.id,
    description: item.description ?? '',
    fitStatus: item.fitStatus as ClosetItemFitStatus | undefined,
    image: item.anchorImageUri
      ? {
          uri: item.anchorImageUri,
          width: item.anchorImageWidth ? Number(item.anchorImageWidth) : undefined,
          height: item.anchorImageHeight ? Number(item.anchorImageHeight) : undefined,
          fileName: item.anchorImageFileName ?? undefined,
          mimeType: item.anchorImageMimeType ?? undefined,
        }
      : null,
    uploadedImage:
      item.uploadedAnchorImageId && item.uploadedAnchorImagePublicUrl && item.uploadedAnchorImageStorageKey
        ? {
            id: item.uploadedAnchorImageId,
            category: (item.uploadedAnchorImageCategory as UploadedImageAsset['category']) ?? 'anchor-item',
            storageProvider: item.uploadedAnchorImageStorageProvider ?? 'local',
            storageKey: item.uploadedAnchorImageStorageKey,
            publicUrl: item.uploadedAnchorImagePublicUrl,
            originalFilename: item.uploadedAnchorImageOriginalFilename ?? null,
            mimeType: item.anchorImageMimeType ?? null,
            sizeBytes: item.uploadedAnchorImageSizeBytes ? Number(item.uploadedAnchorImageSizeBytes) : null,
            width: item.anchorImageWidth ? Number(item.anchorImageWidth) : null,
            height: item.anchorImageHeight ? Number(item.anchorImageHeight) : null,
            createdAt: new Date().toISOString(),
          }
        : null,
  };
}

function parseAnchorItems(params: LookRouteParams): LookAnchorItem[] {
  if (params.anchorItems) {
    try {
      const parsed = JSON.parse(params.anchorItems);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is SerializedAnchorItem => typeof item === 'object' && item !== null && typeof item.id === 'string')
          .map(parseSerializedAnchorItem)
          .filter((item) => item.description.trim() || item.image || item.uploadedImage);
      }
    } catch {
      // ignore and fall through to legacy single-item parsing
    }
  }

  const legacyItem: LookAnchorItem = {
    id: 'anchor-primary',
    description: params.anchorItemDescription ?? '',
    image: params.anchorImageUri
      ? {
          uri: params.anchorImageUri,
          width: params.anchorImageWidth ? Number(params.anchorImageWidth) : undefined,
          height: params.anchorImageHeight ? Number(params.anchorImageHeight) : undefined,
          fileName: params.anchorImageFileName ?? undefined,
          mimeType: params.anchorImageMimeType ?? undefined,
        }
      : null,
    uploadedImage: parseUploadedAnchorImage(params),
  };

  return legacyItem.description.trim() || legacyItem.image || legacyItem.uploadedImage ? [legacyItem] : [];
}

function serializeAnchorItems(anchorItems: LookAnchorItem[]) {
  return JSON.stringify(
    anchorItems.map((item) => ({
      id: item.id,
      description: item.description,
      fitStatus: item.fitStatus,
      anchorImageUri: item.image?.uri,
      anchorImageWidth: item.image?.width ? String(item.image.width) : undefined,
      anchorImageHeight: item.image?.height ? String(item.image.height) : undefined,
      anchorImageFileName: item.image?.fileName ?? undefined,
      anchorImageMimeType: item.image?.mimeType ?? undefined,
      uploadedAnchorImageId: item.uploadedImage?.id,
      uploadedAnchorImageCategory: item.uploadedImage?.category,
      uploadedAnchorImageStorageProvider: item.uploadedImage?.storageProvider,
      uploadedAnchorImageStorageKey: item.uploadedImage?.storageKey,
      uploadedAnchorImagePublicUrl: item.uploadedImage?.publicUrl,
      uploadedAnchorImageOriginalFilename: item.uploadedImage?.originalFilename ?? undefined,
      uploadedAnchorImageSizeBytes: item.uploadedImage?.sizeBytes ? String(item.uploadedImage.sizeBytes) : undefined,
    }))
  );
}

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

function parseWeatherContext(params: LookRouteParams): WeatherContext | null {
  if (!params.weatherSeason || !params.weatherSummary || !params.weatherFetchedAt) {
    return null;
  }

  const season = params.weatherSeason as WeatherSeason;
  if (!['winter', 'spring', 'summer', 'fall'].includes(season)) {
    return null;
  }

  return {
    temperatureC: params.weatherTemperatureC ? Number(params.weatherTemperatureC) : 0,
    apparentTemperatureC: params.weatherApparentTemperatureC ? Number(params.weatherApparentTemperatureC) : 0,
    dailyHighC: null,
    dailyLowC: null,
    weatherCode: params.weatherCode ? Number(params.weatherCode) : 0,
    season,
    summary: params.weatherSummary,
    stylingHint: params.weatherStylingHint ?? '',
    locationLabel: params.weatherLocationLabel ?? null,
    fetchedAt: params.weatherFetchedAt,
  };
}

export function parseLookRecommendation(
  params: Pick<
    LookRouteParams,
    | 'recommendationTitle'
    | 'recommendationAnchorItem'
    | 'recommendationKeyPieces'
    | 'recommendationShoes'
    | 'recommendationAccessories'
    | 'recommendationFitNotes'
    | 'recommendationWhyItWorks'
    | 'recommendationStylingDirection'
    | 'recommendationDetailNotes'
    | 'recommendationSketchStatus'
    | 'recommendationSketchImageUrl'
    | 'recommendationSketchStorageKey'
    | 'recommendationSketchMimeType'
  > &
    { tier?: string }
): LookRecommendation | null {
  if (!params.tier || !LOOK_TIER_OPTIONS.includes(params.tier as LookTierSlug) || !params.recommendationTitle) {
    return null;
  }

  return {
    tier: params.tier as LookTierSlug,
    title: params.recommendationTitle,
    anchorItem: params.recommendationAnchorItem ?? '',
    keyPieces: decodePieceList(params.recommendationKeyPieces),
    shoes: decodePieceList(params.recommendationShoes),
    accessories: decodePieceList(params.recommendationAccessories),
    fitNotes: decodeList(params.recommendationFitNotes),
    whyItWorks: params.recommendationWhyItWorks ?? '',
    stylingDirection: params.recommendationStylingDirection ?? '',
    detailNotes: decodeList(params.recommendationDetailNotes),
    sketchStatus:
      params.recommendationSketchStatus === 'ready' || params.recommendationSketchStatus === 'failed'
        ? params.recommendationSketchStatus
        : 'pending',
    sketchImageUrl: params.recommendationSketchImageUrl ?? null,
    sketchStorageKey: params.recommendationSketchStorageKey ?? null,
    sketchMimeType: params.recommendationSketchMimeType ?? null,
  };
}

export function buildLookResultsHref(requestId: string, input: CreateLookInput): Href {
  return {
    pathname: '/results/[requestId]',
    params: buildLookRouteParams(requestId, input),
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

