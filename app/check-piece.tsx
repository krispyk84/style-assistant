import { router, useLocalSearchParams } from 'expo-router';
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
import type { CompatibilityCheckResponse } from '@/types/api';
import { compatibilityService } from '@/services/compatibility';

export default function CheckPieceScreen() {
  const params = useLocalSearchParams<{
    requestId?: string;
    tier?: string;
    outfitTitle?: string;
    anchorItemDescription?: string;
    pieceName?: string;
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
    useUploadedImage('candidate-piece');
  const [analysis, setAnalysis] = useState<CompatibilityCheckResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  async function runAnalysis() {
    if (!image) {
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    const response = await compatibilityService.analyzePiece({
      image,
      uploadedImage,
      requestId: params.requestId,
      tier: params.tier,
      outfitTitle: params.outfitTitle,
      anchorItemDescription: params.anchorItemDescription,
      pieceName: params.pieceName,
    });

    if (response.success && response.data) {
      setAnalysis(response.data);
    } else {
      setAnalysis(null);
      setAnalysisError(response.error?.message ?? 'Failed to analyze the selected piece.');
    }

    setIsAnalyzing(false);
  }

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl }}>
        <SectionHeader
          title="Check a piece"
          subtitle={
            params.pieceName
              ? `Compare your own ${params.pieceName} against the selected ${params.tier?.replaceAll('-', ' ')} recommendation.`
              : 'Upload a candidate piece and the backend will evaluate whether it supports the selected outfit.'
          }
        />
        {params.outfitTitle ? (
          <View style={{ gap: spacing.xs }}>
            <AppText variant="sectionTitle">Selected outfit</AppText>
            <AppText tone="muted">
              {params.outfitTitle}
              {params.anchorItemDescription ? ` • anchored by ${params.anchorItemDescription}` : ''}
            </AppText>
          </View>
        ) : null}
        <ImagePickerField
          label="Candidate piece image"
          hint={
            params.pieceName
              ? `Upload the ${params.pieceName} you own so the app can assess whether it fits the recommendation.`
              : 'Choose the item you want reviewed against your wardrobe direction.'
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
          futureCameraHint="Use your library or capture the piece directly with the camera."
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
          <AppText variant="sectionTitle">How it works</AppText>
          <AppText tone="muted">
            The image is uploaded first, then the backend reviews it against your selected outfit context and returns a compatibility verdict.
          </AppText>
          {image && uploadedImage ? (
            <PrimaryButton
              label={isAnalyzing ? 'Analyzing...' : 'Check this piece'}
              onPress={runAnalysis}
              disabled={isAnalyzing}
            />
          ) : null}
        </View>
        {analysisError ? <ErrorState title="Analysis unavailable" message={analysisError} /> : null}
        {analysisError ? (
          <PrimaryButton
            label={isAnalyzing ? 'Analyzing...' : 'Retry analysis'}
            onPress={runAnalysis}
            disabled={isAnalyzing || !image || !uploadedImage}
            variant="secondary"
          />
        ) : null}
        {analysis ? (
          <>
            <MockAnalysisCard
              title={params.pieceName ? `${params.pieceName} verdict` : 'Candidate piece verdict'}
              response={analysis}
            />
            {params.tier && params.outfitTitle ? (
              <PrimaryButton
                label="Continue to selfie review"
                onPress={() =>
                  router.push({
                    pathname: '/selfie-review',
                    params: {
                      requestId: params.requestId,
                      tier: params.tier,
                      outfitTitle: params.outfitTitle,
                      anchorItemDescription: params.anchorItemDescription,
                    },
                  })
                }
              />
            ) : null}
          </>
        ) : (
          <EmptyState
            title="No piece selected"
            message="Choose an image from your photo library to get a compatibility assessment for the piece you own."
          />
        )}
      </View>
    </AppScreen>
  );
}
