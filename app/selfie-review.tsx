import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { MockAnalysisCard } from '@/components/cards/mock-analysis-card';
import { ImagePickerField } from '@/components/forms/image-picker-field';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionHeader } from '@/components/ui/section-header';
import { spacing, theme } from '@/constants/theme';
import { useUploadedImage } from '@/hooks/use-uploaded-image';
import { selfieReviewService } from '@/services/selfie-review';
import type { SelfieReviewResponse } from '@/types/api';

export default function SelfieReviewScreen() {
  const params = useLocalSearchParams<{
    requestId?: string;
    tier?: string;
    outfitTitle?: string;
    anchorItemDescription?: string;
  }>();
  const {
    image,
    uploadedImage,
    isPicking,
    isUploading,
    uploadProgress,
    error,
    uploadSuccessMessage,
    pickFromLibrary,
    takePhoto,
    removeImage,
  } =
    useUploadedImage('selfie');
  const [analysis, setAnalysis] = useState<SelfieReviewResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  async function runReview() {
    if (!image) {
      return;
    }

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

  return (
    <AppScreen scrollable topInset={false}>
      <View style={{ gap: spacing.xl }}>
        <SectionHeader
          title="Selfie review"
          subtitle={
            params.outfitTitle
              ? `Check whether your final outfit matches the tone and essence of the selected ${params.tier?.replaceAll('-', ' ')} recommendation.`
              : 'Upload a clear outfit photo to review how well you executed the selected recommendation.'
          }
        />
        {params.outfitTitle ? (
          <View style={{ gap: spacing.xs }}>
            <AppText variant="sectionTitle">Target outfit</AppText>
            <AppText tone="muted">
              {params.outfitTitle}
              {params.anchorItemDescription ? ` • anchored by ${params.anchorItemDescription}` : ''}
            </AppText>
          </View>
        ) : null}
        <ImagePickerField
          label="Selfie image"
          hint={
            params.outfitTitle
              ? 'Upload a selfie wearing your version of the recommended outfit.'
              : 'Choose a clear full-body or upper-body image from your library.'
          }
          image={image}
          isPicking={isPicking || isUploading}
          error={error}
          statusMessage={
            isUploading
              ? `Uploading ${Math.round(uploadProgress * 100)}%`
              : uploadedImage
                ? uploadSuccessMessage ?? 'Upload complete.'
                : null
          }
          pickLabel={isUploading ? `Uploading ${Math.round(uploadProgress * 100)}%` : 'Choose from library'}
          cameraLabel="Take photo"
          futureCameraHint="Use your library or capture a fresh outfit photo with the camera."
          onPick={pickFromLibrary}
          onTakePhoto={takePhoto}
          onRemove={() => {
            removeImage();
            setAnalysis(null);
            setAnalysisError(null);
          }}
        />
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: 28,
            borderWidth: 1,
            gap: spacing.sm,
            padding: spacing.lg,
          }}>
          <AppText variant="sectionTitle">Review behavior</AppText>
          <AppText tone="muted">
            The image is uploaded first, then the backend judges whether your final outfit still captures the original recommendation.
          </AppText>
          {image && uploadedImage ? (
            <PrimaryButton
              label={isAnalyzing ? 'Reviewing...' : 'Review this outfit'}
              onPress={runReview}
              disabled={isAnalyzing}
            />
          ) : null}
        </View>
        {analysisError ? <ErrorState title="Review unavailable" message={analysisError} /> : null}
        {analysisError ? (
          <PrimaryButton
            label={isAnalyzing ? 'Reviewing...' : 'Retry review'}
            onPress={runReview}
            disabled={isAnalyzing || !image || !uploadedImage}
            variant="secondary"
          />
        ) : null}
        {analysis ? (
          <MockAnalysisCard title="Selfie styling review" response={analysis} />
        ) : (
          <EmptyState
            title="No selfie selected"
            message="Choose a photo from your library to review how well your final outfit matches the selected recommendation."
          />
        )}
      </View>
    </AppScreen>
  );
}
