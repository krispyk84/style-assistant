import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { MockAnalysisCard } from '@/components/cards/mock-analysis-card';
import { ImagePickerField } from '@/components/forms/image-picker-field';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { ErrorState } from '@/components/ui/error-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { RemoteImagePanel } from '@/components/ui/remote-image-panel';
import { ScreenHeader } from '@/components/ui/screen-header';
import { spacing } from '@/constants/theme';
import { useSelfieReview } from './useSelfieReview';

export default function SelfieReviewScreen() {
  const params = useLocalSearchParams<{
    requestId?: string;
    tier?: string;
    outfitTitle?: string;
    anchorItemDescription?: string;
    sketchImageUrl?: string;
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
    handleOpenCamera,
    handleClearImage,
    analysis,
    isAnalyzing,
    analysisError,
    runReview,
  } = useSelfieReview({
    requestId: params.requestId,
    tier: params.tier,
    outfitTitle: params.outfitTitle,
    anchorItemDescription: params.anchorItemDescription,
  });

  const sketchImageUrl = params.sketchImageUrl || null;

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
        <ScreenHeader title="Selfie Review" showBack />

        <View style={{ gap: spacing.xs }}>
          <AppText variant="heroSmall">Check Your Outfit</AppText>
          <AppText tone="muted">
            {params.outfitTitle
              ? `See how your look matches the ${params.tier?.replaceAll('-', ' ')} recommendation.`
              : 'Upload a clear outfit photo to review your execution.'}
          </AppText>
        </View>

        {/* Target outfit sketch */}
        {sketchImageUrl ? (
          <View style={{ gap: spacing.sm }}>
            <AppText variant="eyebrow" style={{ letterSpacing: 1.8 }}>
              Target Outfit
            </AppText>
            <RemoteImagePanel
              uri={sketchImageUrl}
              aspectRatio={4 / 5}
              minHeight={280}
              fallbackTitle="Sketch unavailable"
              fallbackMessage="The outfit sketch could not be displayed."
            />
          </View>
        ) : params.outfitTitle ? (
          <View style={{ gap: spacing.xs }}>
            <AppText variant="eyebrow" style={{ letterSpacing: 1.8 }}>
              Target Outfit
            </AppText>
            <AppText tone="muted">{params.outfitTitle}</AppText>
          </View>
        ) : null}

        {/* Image picker */}
        <ImagePickerField
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
          onTakePhoto={handleOpenCamera}
          onRemove={handleClearImage}
        />

        {/* Submit button — shown once image is uploaded */}
        {image && uploadedImage ? (
          <PrimaryButton
            label={isAnalyzing ? 'Reviewing...' : 'Review this outfit'}
            onPress={runReview}
            disabled={isAnalyzing}
          />
        ) : null}

        {analysisError ? (
          <>
            <ErrorState title="Review unavailable" message={analysisError} />
            <PrimaryButton
              label={isAnalyzing ? 'Reviewing...' : 'Retry review'}
              onPress={runReview}
              disabled={isAnalyzing || !image || !uploadedImage}
              variant="secondary"
            />
          </>
        ) : null}

        {analysis ? (
          <MockAnalysisCard title="Selfie styling review" response={analysis} />
        ) : null}
      </View>
    </AppScreen>
  );
}
