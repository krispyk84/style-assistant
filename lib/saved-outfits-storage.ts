import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CreateLookInput, LookRecommendation } from '@/types/look-request';
import type { SavedOutfit } from '@/types/style';

const STORAGE_KEY = 'style-assistant/saved-outfits';

export function buildSavedOutfitId(requestId: string, tier: LookRecommendation['tier']) {
  return `${requestId}:${tier}`;
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
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt));
  } catch {
    return [];
  }
}

export async function saveSavedOutfit(input: CreateLookInput, recommendation: LookRecommendation, requestId: string) {
  const savedOutfits = await loadSavedOutfits();
  const id = buildSavedOutfitId(requestId, recommendation.tier);
  const existing = savedOutfits.find((item) => item.id === id);

  if (existing) {
    return existing;
  }

  const nextSavedOutfit: SavedOutfit = {
    id,
    requestId,
    savedAt: new Date().toISOString(),
    input,
    recommendation,
  };

  const nextSavedOutfits = [nextSavedOutfit, ...savedOutfits];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextSavedOutfits));
  return nextSavedOutfit;
}

export async function deleteSavedOutfit(savedOutfitId: string) {
  const savedOutfits = await loadSavedOutfits();
  const nextSavedOutfits = savedOutfits.filter((item) => item.id !== savedOutfitId);

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextSavedOutfits));
  return nextSavedOutfits;
}
