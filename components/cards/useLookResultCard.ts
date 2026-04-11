import { useMemo, useState } from 'react';

import type { ClosetItem } from '@/types/closet';
import type { LookRecommendation } from '@/types/look-request';
import { buildLabeledPieces } from './look-result-card-helpers';

// ── Types ──────────────────────────────────────────────────────────────────────

export type MatchedPiece = {
  item: ClosetItem;
  suggestion: string;
  confidencePercent: number;
};

// ── Hook ───────────────────────────────────────────────────────────────────────

type UseLookResultCardParams = {
  recommendation: LookRecommendation;
  closetItems: ClosetItem[];
  matchMap?: Record<string, ClosetItem | null | false>;
  anchorDescription?: string;
};

export function useLookResultCard({
  recommendation,
  closetItems,
  matchMap,
  anchorDescription,
}: UseLookResultCardParams) {
  const [matchedPiece, setMatchedPiece] = useState<MatchedPiece | null>(null);

  const labeledPieces = useMemo(
    () => buildLabeledPieces(recommendation, closetItems, matchMap, anchorDescription),
    [recommendation, closetItems, matchMap, anchorDescription]
  );

  const hasAnyMatch = labeledPieces.some((p) => !p.isAnchor && p.matchedClosetItem !== null);

  return { labeledPieces, hasAnyMatch, matchedPiece, setMatchedPiece };
}
