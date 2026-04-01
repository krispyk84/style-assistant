import AsyncStorage from '@react-native-async-storage/async-storage';

import { appConfig } from '@/constants/config';
import type { CreateLookInput, LookAnchorItem, LookRecommendation } from '@/types/look-request';
import type { SavedOutfit } from '@/types/style';

const STORAGE_KEY = 'style-assistant/saved-outfits';

export function buildSavedOutfitId(requestId: string, tier: LookRecommendation['tier']) {
  return `${requestId}:${tier}`;
}

function buildStableSavedSketchUri(requestId: string, tier: LookRecommendation['tier']) {
  if (appConfig.useMockServices || !appConfig.apiBaseUrl) {
    return null;
  }

  return `${appConfig.apiBaseUrl}/outfits/${requestId}/sketch/${tier}`;
}

function normalizeAnchorItems(input: CreateLookInput): LookAnchorItem[] {
  if (Array.isArray(input.anchorItems) && input.anchorItems.length) {
    return input.anchorItems;
  }

  if (input.anchorItemDescription || input.anchorImage || input.uploadedAnchorImage) {
    return [
      {
        id: 'anchor-primary',
        description: input.anchorItemDescription ?? '',
        image: input.anchorImage ?? null,
        uploadedImage: input.uploadedAnchorImage ?? null,
      },
    ];
  }

  return [];
}

function normalizeSavedOutfit(savedOutfit: SavedOutfit): SavedOutfit {
  return {
    ...savedOutfit,
    input: {
      ...savedOutfit.input,
      anchorItems: normalizeAnchorItems(savedOutfit.input),
    },
    recommendation: {
      ...savedOutfit.recommendation,
      sketchImageUrl:
        savedOutfit.recommendation.sketchStatus === 'ready'
          ? buildStableSavedSketchUri(savedOutfit.requestId, savedOutfit.recommendation.tier)
          : savedOutfit.recommendation.sketchImageUrl ?? null,
    },
  };
}

export async function loadSavedOutfits(): Promise<SavedOutfit[]> {
  const rawValue = await AsyncStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is SavedOutfit => {
        return (
          typeof item === 'object' &&
          item !== null &&
          typeof item.id === 'string' &&
          typeof item.requestId === 'string' &&
          typeof item.savedAt === 'string' &&
          typeof item.input === 'object' &&
          item.input !== null &&
          typeof item.recommendation === 'object' &&
          item.recommendation !== null
        );
      })
      .map(normalizeSavedOutfit)
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt));
  } catch {
    return [];
  }
}

export async function saveSavedOutfit(input: CreateLookInput, recommendation: LookRecommendation, requestId: string) {
  const savedOutfits = await loadSavedOutfits();
  const id = buildSavedOutfitId(requestId, recommendation.tier);
  const nextSavedOutfit: SavedOutfit = {
    id,
    requestId,
    savedAt: new Date().toISOString(),
    input,
    recommendation: {
      ...recommendation,
      sketchImageUrl:
        recommendation.sketchStatus === 'ready'
          ? buildStableSavedSketchUri(requestId, recommendation.tier)
          : recommendation.sketchImageUrl ?? null,
    },
  };

  const nextSavedOutfits = [nextSavedOutfit, ...savedOutfits.filter((item) => item.id !== id)];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextSavedOutfits));
  return normalizeSavedOutfit(nextSavedOutfit);
}

export async function deleteSavedOutfit(savedOutfitId: string) {
  const savedOutfits = await loadSavedOutfits();
  const nextSavedOutfits = savedOutfits.filter((item) => item.id !== savedOutfitId);

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextSavedOutfits));
  return nextSavedOutfits;
}

export async function replaceSavedOutfits(savedOutfits: SavedOutfit[]) {
  const normalizedSavedOutfits = savedOutfits.map(normalizeSavedOutfit);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedSavedOutfits));
  return normalizedSavedOutfits;
}
