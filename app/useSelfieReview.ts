import { useState } from 'react';
import { useRouter } from 'expo-router';

import { useUploadedImage } from '@/hooks/use-uploaded-image';
import { cameraCaptureResult } from '@/lib/camera-capture-result';
import { recordError } from '@/lib/crashlytics';
import { selfieReviewService } from '@/services/selfie-review';
import type { SelfieReviewResponse } from '@/types/api';

export type SelfieReviewParams = {
  requestId?: string;
  tier?: string;
  outfitTitle?: string;
  anchorItemDescription?: string;
};

export function useSelfieReview(params: SelfieReviewParams) {
  const router = useRouter();
  const {
    image,
    uploadedImage,
    isPicking,
    isUploading,
    uploadProgress,
    error,
    uploadSuccessMessage,
    pickFromLibrary,
    removeImage,
    setImage,
    uploadImage,
  } = useUploadedImage('selfie');
  const [analysis, setAnalysis] = useState<SelfieReviewResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  function handleOpenCamera() {
    cameraCaptureResult.setListener(async (captured) => {
      setImage(captured);
      try {
        await uploadImage(captured);
      } catch (uploadErr) {
        recordError(uploadErr instanceof Error ? uploadErr : new Error(String(uploadErr)), 'selfie_review_camera_upload');
      }
    });
    router.push('/camera-capture');
  }

  function handleClearImage() {
    removeImage();
    setAnalysis(null);
    setAnalysisError(null);
  }

  async function runReview() {
    if (!image) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const response = await selfieReviewService.analyzeSelfie({
        image,
        uploadedImage,
        requestId: params.requestId,
        tier: params.tier,
        outfitTitle: params.outfitTitle,
        anchorItemDescription: params.anchorItemDescription,
      });

      if (response.success && response.data) {
        setAnalysis(response.data);
      } else {
        setAnalysis(null);
        setAnalysisError(response.error?.message ?? 'Failed to review the selected selfie.');
      }
    } catch (err) {
      recordError(err instanceof Error ? err : new Error(String(err)), 'selfie_review_analyze');
      setAnalysis(null);
      setAnalysisError('Failed to review the selected selfie.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  return {
    image,
    uploadedImage,
    isPicking,
    isUploading,
    uploadProgress,
    error,
    uploadSuccessMessage,
    pickFromLibrary,
    handleOpenCamera,
    handleClearImage,
    analysis,
    isAnalyzing,
    analysisError,
    runReview,
  };
}
