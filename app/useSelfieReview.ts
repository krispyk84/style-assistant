import { useState } from 'react';
import { useRouter } from 'expo-router';

import { useUploadedImage } from '@/hooks/use-uploaded-image';
import { cameraCaptureResult } from '@/lib/camera-capture-result';
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
      await uploadImage(captured);
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

    setIsAnalyzing(false);
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
