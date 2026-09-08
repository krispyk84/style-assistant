import AsyncStorage from '@react-native-async-storage/async-storage';

import { appConfig } from '@/constants/config';
import { recordError } from '@/lib/crashlytics';
import { stripLegacySketchImageData } from '@/lib/outfit-utils';
import {
  deleteSavedOutfitFromSupabase,
  upsertSavedOutfitToSupabase,
} from '@/lib/supabase-data';
import { markActive, markDeleted } from '@/lib/sync-metadata-storage';
import type { CreateLookInput, LookAnchorItem, LookRecommendation } from '@/types/look-request';
import type { SavedOutfit } from '@/types/style';

const STORAGE_KEY = 'style-assistant/saved-outfits';

// generation 0 uses the legacy format for backward compatibility with existing saved outfits.
// generation > 0 appends :gN to create a distinct slot per regeneration.
export function buildSavedOutfitId(requestId: string, tier: LookRecommendation['tier'], generation = 0) {
  return generation === 0 ? `${requestId}:${tier}` : `${requestId}:${tier}:g${generation}`;
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
      sketchImageUrl: buildStableSavedSketchUri(savedOutfit.requestId, savedOutfit.recommendation.tier)
        ?? savedOutfit.recommendation.sketchImageUrl ?? null,
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

export async function saveSavedOutfit(input: CreateLookInput, recommendation: LookRecommendation, requestId: string, generation = 0) {
  const savedOutfits = await loadSavedOutfits();
  const id = buildSavedOutfitId(requestId, recommendation.tier, generation);
  const nextSavedOutfit: SavedOutfit = {
    id,
    requestId,
    savedAt: new Date().toISOString(),
    input,
    recommendation: {
      ...stripLegacySketchImageData(recommendation),
      sketchImageUrl: buildStableSavedSketchUri(requestId, recommendation.tier)
        ?? recommendation.sketchImageUrl ?? null,
    },
  };

  const nextSavedOutfits = [nextSavedOutfit, ...savedOutfits.filter((item) => item.id !== id)];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextSavedOutfits));
  void upsertSavedOutfitToSupabase(nextSavedOutfit).catch((error) => recordError(error, 'saved_outfit_save_upsert'));
  // Phase 1B.1: awaited, not fire-and-forget, and not caught here — covers
  // both a brand-new id and an intentional re-save of a previously-deleted
  // id (reachable again if the same requestId+tier is saved after having
  // been deleted). Awaiting (rather than firing-and-forgetting) makes the
  // metadata state deterministically consistent with this save by the time
  // the caller sees it succeed — in particular, so a stale tombstone from
  // an earlier deletion of this same id is reliably cleared rather than
  // possibly surviving a process kill mid-write, which would otherwise
  // leave "domain object active" contradicting "metadata says deleted."
  // Left uncaught so a genuine failure here surfaces to the caller instead
  // of silently diverging from the domain object, which was already
  // written above.
  await markActive('saved-outfits', id);
  return normalizeSavedOutfit(nextSavedOutfit);
}

export async function deleteSavedOutfit(savedOutfitId: string) {
  // Phase 1B.1: tombstone persisted FIRST, awaited, and uncaught. If we
  // cannot durably record deletion intent, the deletion must not proceed —
  // the domain object below is never touched, and this function's promise
  // rejects so the caller never observes a successful deletion whose
  // tombstone didn't actually persist. This is the fix for the gap
  // identified in Phase 1B's report: the previous fire-and-forget ordering
  // let the domain object be removed and the caller see success before the
  // tombstone write had necessarily completed, so an app kill in that
  // window could lose deletion intent entirely and irrecoverably. Tombstone-
  // first instead means the only reachable partial-failure state is
  // "tombstone recorded, domain object still present" — safely recoverable
  // (a retry is idempotent; the record simply looks not-yet-deleted, never
  // silently un-deleted).
  await markDeleted('saved-outfits', savedOutfitId);

  const savedOutfits = await loadSavedOutfits();
  const nextSavedOutfits = savedOutfits.filter((item) => item.id !== savedOutfitId);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextSavedOutfits));
  void deleteSavedOutfitFromSupabase(savedOutfitId).catch((error) => recordError(error, 'saved_outfit_delete'));
  return nextSavedOutfits;
}

export async function replaceSavedOutfits(savedOutfits: SavedOutfit[]) {
  const normalizedSavedOutfits = savedOutfits.map(normalizeSavedOutfit);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedSavedOutfits));
  return normalizedSavedOutfits;
}
