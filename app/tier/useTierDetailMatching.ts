import { useEffect, useMemo, useState } from 'react';

import { useMatchFeedback } from '@/hooks/use-match-feedback';
import { useMatchSensitivity } from '@/hooks/use-match-sensitivity';
import { trackClosetMatchShown } from '@/lib/analytics';
import { findBestClosetMatch } from '@/lib/closet-match';
import type { ClosetItem } from '@/types/closet';
import type { LookRecommendation, OutfitPiece } from '@/types/look-request';

// ── Types ──────────────────────────────────────────────────────────────────────

export type SheetPiece = {
  item: ClosetItem;
  suggestion: string;
  confidencePercent: number;
};

type UseTierDetailMatchingParams = {
  /** Stable route params — used for requestId, tier (analytics + feedback hook). */
  requestId: string;
  tier: string;
  /** May be null before route params are parsed; uniquePieces returns [] and matching skips. */
  liveRecommendation: LookRecommendation | null;
  closetItems: ClosetItem[];
};

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useTierDetailMatching({
  requestId,
  tier,
  liveRecommendation,
  closetItems,
}: UseTierDetailMatchingParams) {
  const [matchMap, setMatchMap] = useState<Record<string, ClosetItem | null | false>>({});
  const [sheetPiece, setSheetPiece] = useState<SheetPiece | null>(null);

  const sensitivity = useMatchSensitivity();

  // Stable: pieces come from route params, don't change after mount
  const uniquePieces = useMemo((): OutfitPiece[] => {
    if (!liveRecommendation) return [];
    const allPieces = [
      ...liveRecommendation.keyPieces,
      ...liveRecommendation.shoes,
      ...liveRecommendation.accessories,
    ];
    const seen = new Set<string>();
    return allPieces.filter((piece) => {
      if (seen.has(piece.display_name)) return false;
      seen.add(piece.display_name);
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, tier]);

  const { matchFeedbackMap, regeneratingMatches, handleMatchThumbsUp, handleMatchThumbsDown } =
    useMatchFeedback({
      requestId,
      closetItems,
      pieces: uniquePieces,
      sensitivity,
      onSlotRematched: (suggestion, item) =>
        // null from rematch means all candidates exhausted → false sentinel prevents local-scoring fallback
        setMatchMap((prev) => ({ ...prev, [suggestion]: item ?? false })),
    });

  // ── Local deterministic matching (runs when both closet and pieces are ready) ──
  useEffect(() => {
    if (!uniquePieces.length || !closetItems.length) return;

    const resolved: Record<string, ClosetItem | null> = {};
    for (const piece of uniquePieces) {
      resolved[piece.display_name] = findBestClosetMatch(piece, closetItems, undefined, sensitivity);
    }
    setMatchMap(resolved);
    const matchCount = Object.values(resolved).filter(Boolean).length;
    if (matchCount > 0) {
      trackClosetMatchShown({ match_count: matchCount, tier });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniquePieces, closetItems]);

  return {
    matchMap,
    uniquePieces,
    sheetPiece,
    setSheetPiece,
    matchFeedbackMap,
    regeneratingMatches,
    handleMatchThumbsUp,
    handleMatchThumbsDown,
  };
}
