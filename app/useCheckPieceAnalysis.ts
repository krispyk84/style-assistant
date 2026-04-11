import { useState } from 'react';

import {
  trackCheckPieceStarted,
  trackCheckPieceCompleted,
  trackCheckPieceFailed,
} from '@/lib/analytics';
import { recordError } from '@/lib/crashlytics';
import { compatibilityService } from '@/services/compatibility';
import type { ClosetItem } from '@/types/closet';
import type { CompatibilityCheckResponse } from '@/types/api';
import type { LocalImageAsset, UploadedImageAsset } from '@/types/media';

// ── Types ──────────────────────────────────────────────────────────────────────

type RunAnalysisArgs = {
  image: LocalImageAsset | null;
  uploadedImage: UploadedImageAsset | null;
  selectedClosetItem: ClosetItem | null;
  params: {
    requestId?: string;
    tier?: string;
    outfitTitle?: string;
    anchorItemDescription?: string;
    pieceName?: string;
  };
};

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useCheckPieceAnalysis() {
  const [analysis, setAnalysis] = useState<CompatibilityCheckResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  async function runAnalysis({ image, uploadedImage, selectedClosetItem, params }: RunAnalysisArgs) {
    if (!image && !selectedClosetItem) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    trackCheckPieceStarted({ source: selectedClosetItem ? 'closet' : 'photo' });

    let response;

    if (selectedClosetItem) {
      const imageUri =
        selectedClosetItem.uploadedImageUrl ?? selectedClosetItem.sketchImageUrl ?? '';
      response = await compatibilityService.analyzePiece({
        image: { uri: imageUri },
        requestId: params.requestId,
        tier: params.tier,
        outfitTitle: params.outfitTitle,
        anchorItemDescription: params.anchorItemDescription,
        pieceName: params.pieceName,
        candidateItemDescription: selectedClosetItem.title,
      });
    } else {
      response = await compatibilityService.analyzePiece({
        image: image!,
        uploadedImage,
        requestId: params.requestId,
        tier: params.tier,
        outfitTitle: params.outfitTitle,
        anchorItemDescription: params.anchorItemDescription,
        pieceName: params.pieceName,
      });
    }

    if (response.success && response.data) {
      setAnalysis(response.data);
      trackCheckPieceCompleted({ verdict: response.data.verdict });
    } else {
      setAnalysis(null);
      setAnalysisError(response.error?.message ?? 'Failed to analyze the selected piece.');
      trackCheckPieceFailed();
      recordError(
        new Error(response.error?.message ?? 'Check piece analysis failed'),
        'check_piece_analysis'
      );
    }

    setIsAnalyzing(false);
  }

  function clearAnalysis() {
    setAnalysis(null);
    setAnalysisError(null);
  }

  return { analysis, isAnalyzing, analysisError, runAnalysis, clearAnalysis };
}
