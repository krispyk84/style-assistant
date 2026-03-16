import type { Href } from 'expo-router';

import type { CreateLookInput, LookRecommendation } from '@/types/look-request';
import type { LocalImageAsset, UploadedImageAsset } from '@/types/media';
import { LOOK_TIER_OPTIONS, type LookTierSlug } from '@/types/look-request';

type LookRouteParams = {
  anchorItemDescription?: string;
  photoPending?: string;
  tiers?: string;
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
  recommendationTitle?: string;
  recommendationAnchorItem?: string;
  recommendationKeyPieces?: string;
  recommendationShoes?: string;
  recommendationAccessories?: string;
  recommendationFitNotes?: string;
  recommendationWhyItWorks?: string;
  recommendationStylingDirection?: string;
  recommendationDetailNotes?: string;
  recommendationSketchStatus?: string;
  recommendationSketchImageUrl?: string;
  recommendationSketchStorageKey?: string;
  recommendationSketchMimeType?: string;
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

export function parseLookInput(params: LookRouteParams): CreateLookInput | null {
  const selectedTiers = (params.tiers?.split(',') ?? []).filter((tier): tier is LookTierSlug =>
    LOOK_TIER_OPTIONS.includes(tier as LookTierSlug)
  );

  if (!selectedTiers.length) {
    return null;
  }

  return {
    anchorItemDescription: params.anchorItemDescription ?? '',
    photoPending: params.photoPending === 'true',
    selectedTiers,
    uploadedAnchorImage: parseUploadedAnchorImage(params),
    anchorImage: params.anchorImageUri
      ? {
          uri: params.anchorImageUri,
          width: params.anchorImageWidth ? Number(params.anchorImageWidth) : undefined,
          height: params.anchorImageHeight ? Number(params.anchorImageHeight) : undefined,
          fileName: params.anchorImageFileName ?? undefined,
          mimeType: params.anchorImageMimeType ?? undefined,
        }
      : null,
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
    keyPieces: decodeList(params.recommendationKeyPieces),
    shoes: decodeList(params.recommendationShoes),
    accessories: decodeList(params.recommendationAccessories),
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
    params: {
      requestId,
      anchorItemDescription: input.anchorItemDescription,
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
    },
  };
}

export function buildLookRouteParams(requestId: string, input: CreateLookInput) {
  return {
    requestId,
    anchorItemDescription: input.anchorItemDescription,
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
  };
}

export function buildTierHref(
  tier: LookTierSlug,
  requestId: string,
  input: CreateLookInput,
  recommendation: LookRecommendation,
  variantIndex: number
): Href {
  return {
    pathname: '/tier/[tier]',
    params: {
      tier,
      requestId,
      anchorItemDescription: input.anchorItemDescription,
      photoPending: String(input.photoPending),
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
      recommendationTitle: recommendation.title,
      recommendationAnchorItem: recommendation.anchorItem,
      recommendationKeyPieces: encodeList(recommendation.keyPieces),
      recommendationShoes: encodeList(recommendation.shoes),
      recommendationAccessories: encodeList(recommendation.accessories),
      recommendationFitNotes: encodeList(recommendation.fitNotes),
      recommendationWhyItWorks: recommendation.whyItWorks,
      recommendationStylingDirection: recommendation.stylingDirection,
      recommendationDetailNotes: encodeList(recommendation.detailNotes),
      recommendationSketchStatus: recommendation.sketchStatus,
      recommendationSketchImageUrl: recommendation.sketchImageUrl ?? undefined,
      recommendationSketchStorageKey: recommendation.sketchStorageKey ?? undefined,
      recommendationSketchMimeType: recommendation.sketchMimeType ?? undefined,
      variantIndex: String(variantIndex),
    },
  };
}

export function normalizePickedImage(asset: {
  uri: string;
  width?: number;
  height?: number;
  fileName?: string | null;
  mimeType?: string | null;
}): LocalImageAsset {
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    fileName: asset.fileName ?? null,
    mimeType: asset.mimeType ?? null,
  };
}
