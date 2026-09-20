import { useState } from 'react';

import { closetService } from '@/services/closet';
import type { UploadedImageAsset } from '@/types/media';

export type ItemKind = 'garment' | 'fragrance';

// Mirrors CLASSIFY_ITEM_KIND_CONFIDENCE_THRESHOLD in
// backend/src/ai/prompts/fragrance-classify.prompts.ts — kept in sync by hand
// since the frontend and backend are separate packages. Below this, the mode
// is left as-is and the user corrects manually rather than being auto-switched.
const AUTO_SWITCH_CONFIDENCE_THRESHOLD = 0.7;

type DetectedKind = {
  kind: ItemKind;
  confidence: number;
  brandGuess: string | null;
  nameGuess: string | null;
};

type UseItemKindDetectionParams = {
  initialItemKind: ItemKind;
};

/**
 * Owns the garment-vs-fragrance mode for the Add Closet Item flow: a
 * best-effort auto-classification once a photo is uploaded, plus an explicit
 * manual override the user can invoke at any time (and which auto-detection
 * never overrides once set) — see spec: fragrance mode reachable via both
 * confident AI auto-detection AND explicit manual selection, with the
 * ability to correct a wrong classification.
 */
export function useItemKindDetection({ initialItemKind }: UseItemKindDetectionParams) {
  const [itemKind, setItemKindState] = useState<ItemKind>(initialItemKind);
  const [detected, setDetected] = useState<DetectedKind | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [manuallySet, setManuallySet] = useState(false);

  async function detectFromImage(uploadedImage: UploadedImageAsset) {
    setIsDetecting(true);
    const response = await closetService.classifyItemKind({
      uploadedImageId: uploadedImage.id,
      uploadedImageUrl: uploadedImage.publicUrl,
    });
    setIsDetecting(false);

    if (!response.success || !response.data || response.data.itemKind === 'unknown') return;

    const result: DetectedKind = {
      kind: response.data.itemKind,
      confidence: response.data.confidence,
      brandGuess: response.data.fragranceBrandGuess ?? null,
      nameGuess: response.data.fragranceNameGuess ?? null,
    };
    setDetected(result);

    if (!manuallySet && result.confidence >= AUTO_SWITCH_CONFIDENCE_THRESHOLD) {
      setItemKindState(result.kind);
    }
  }

  function setItemKind(kind: ItemKind) {
    setManuallySet(true);
    setItemKindState(kind);
  }

  function reset(nextInitialKind: ItemKind) {
    setItemKindState(nextInitialKind);
    setDetected(null);
    setIsDetecting(false);
    setManuallySet(false);
  }

  return { itemKind, setItemKind, detected, isDetecting, detectFromImage, reset };
}
