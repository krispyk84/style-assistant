import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { MockAnalysisCard } from '@/components/cards/mock-analysis-card';
import { ImagePickerField } from '@/components/forms/image-picker-field';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { ErrorState } from '@/components/ui/error-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { RemoteImagePanel } from '@/components/ui/remote-image-panel';
import { ScreenHeader } from '@/components/ui/screen-header';
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
    takePhoto,
    removeImage,
  } = useUploadedImage('selfie');
  const [analysis, setAnalysis] = useState<SelfieReviewResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // ── Self-timer state ───────────────────────────────────────────────────────
  const TIMER_OPTIONS = [0, 3, 5, 10] as const;
  type TimerOption = typeof TIMER_OPTIONS[number];
  const [timerDelay, setTimerDelay] = useState<TimerOption>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearCountdown() {
    if (countdownRef.current !== null) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(null);
  }

  function handleTakePhoto() {
    if (timerDelay === 0) {
      void takePhoto();
      return;
    }
    setCountdown(timerDelay);
    let remaining = timerDelay;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearCountdown();
        void takePhoto();
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }

  // Clean up interval on unmount
  useEffect(() => () => clearCountdown(), []);

  const sketchImageUrl = params.sketchImageUrl || null;

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
            <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
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
            <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
              Target Outfit
            </AppText>
            <AppText tone="muted">{params.outfitTitle}</AppText>
          </View>
        ) : null}

        {/* Self-timer selector — only shown when no image yet */}
        {!image ? (
          <View style={{ gap: spacing.xs }}>
            <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
              Self-timer
            </AppText>
            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              {TIMER_OPTIONS.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setTimerDelay(option)}
                  style={{
                    alignItems: 'center',
                    backgroundColor: timerDelay === option ? theme.colors.accent : theme.colors.surface,
                    borderColor: timerDelay === option ? theme.colors.accent : theme.colors.border,
                    borderRadius: 999,
                    borderWidth: 1,
                    minWidth: 52,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                  }}>
                  <AppText style={{ fontSize: 13, color: timerDelay === option ? '#FFF' : theme.colors.text }}>
                    {option === 0 ? 'Off' : `${option}s`}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Countdown overlay */}
        {countdown !== null ? (
          <View
            style={{
              alignItems: 'center',
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: 22,
              borderWidth: 1,
              gap: spacing.sm,
              paddingVertical: spacing.xl,
            }}>
            <AppText style={{ fontSize: 64, fontFamily: theme.fonts.sansMedium, color: theme.colors.accent }}>
              {countdown}
            </AppText>
            <AppText tone="muted">Get ready…</AppText>
            <Pressable
              onPress={() => {
                clearCountdown();
              }}
              style={{
                backgroundColor: theme.colors.subtleSurface,
                borderColor: theme.colors.border,
                borderRadius: 999,
                borderWidth: 1,
                marginTop: spacing.xs,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
              }}>
              <AppText style={{ fontSize: 13 }}>Cancel</AppText>
            </Pressable>
          </View>
        ) : null}

        {/* Image picker — no label */}
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
          cameraLabel={timerDelay > 0 ? `Take photo (${timerDelay}s)` : 'Take photo'}
          futureCameraHint="Use your library or capture a fresh outfit photo with the camera."
          onPick={pickFromLibrary}
          onTakePhoto={countdown !== null ? undefined : handleTakePhoto}
          onRemove={() => {
            removeImage();
            setAnalysis(null);
            setAnalysisError(null);
          }}
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
