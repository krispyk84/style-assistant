import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { MockAnalysisCard } from '@/components/cards/mock-analysis-card';
import { ClosetPickerModal } from '@/components/closet/closet-picker-modal';
import { SaveToClosetModal } from '@/components/closet/save-to-closet-modal';
import { ImagePickerField } from '@/components/forms/image-picker-field';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { ErrorState } from '@/components/ui/error-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { spacing, theme } from '@/constants/theme';
import { useUploadedImage } from '@/hooks/use-uploaded-image';
import { closetService } from '@/services/closet';
import { compatibilityService } from '@/services/compatibility';
import {
  trackCheckPieceStarted,
  trackCheckPieceCompleted,
  trackCheckPieceFailed,
} from '@/lib/analytics';
import { recordError } from '@/lib/crashlytics';
import type { ClosetItem } from '@/types/closet';
import type { CompatibilityCheckResponse } from '@/types/api';

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
  } = useUploadedImage('candidate-piece');
  const [analysis, setAnalysis] = useState<CompatibilityCheckResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [closetModalVisible, setClosetModalVisible] = useState(false);

  // ── Closet picker state ────────────────────────────────────────────────────
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [closetPickerVisible, setClosetPickerVisible] = useState(false);
  const [selectedClosetItem, setSelectedClosetItem] = useState<ClosetItem | null>(null);

  // Load closet items so we can offer the "From Closet" option
  useEffect(() => {
    void closetService.getItems().then((response) => {
      if (response.success && response.data) {
        setClosetItems(response.data.items);
      }
    });
  }, []);

  // ── Source selection helpers ───────────────────────────────────────────────

  function handleClosetItemSelected(item: ClosetItem) {
    // Clear any photo that was previously picked
    if (image) removeImage();
    setSelectedClosetItem(item);
    setAnalysis(null);
    setAnalysisError(null);
    setClosetPickerVisible(false);
  }

  function handlePhotoPickFromLibrary() {
    // Clear any closet selection before picking a photo
    setSelectedClosetItem(null);
    setAnalysis(null);
    setAnalysisError(null);
    void pickFromLibrary();
  }

  function handlePhotoTakePhoto() {
    setSelectedClosetItem(null);
    setAnalysis(null);
    setAnalysisError(null);
    void takePhoto();
  }

  // ── Analysis ──────────────────────────────────────────────────────────────

  async function runAnalysis() {
    if (!image && !selectedClosetItem) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    trackCheckPieceStarted({ source: selectedClosetItem ? 'closet' : 'photo' });

    let response;

    if (selectedClosetItem) {
      // Use the closet item's existing image URL directly — no upload needed.
      // The API service picks up imageUrl from image.uri when no uploadedImage is provided.
      const imageUri =
        selectedClosetItem.uploadedImageUrl ?? selectedClosetItem.sketchImageUrl ?? '';
      response = await compatibilityService.analyzePiece({
        image: { uri: imageUri },
        requestId: params.requestId,
        tier: params.tier,
        outfitTitle: params.outfitTitle,
        anchorItemDescription: params.anchorItemDescription,
        pieceName: params.pieceName ?? selectedClosetItem.title,
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

  // ── Derived state ─────────────────────────────────────────────────────────
  const closetItemImageUri =
    selectedClosetItem?.uploadedImageUrl ?? selectedClosetItem?.sketchImageUrl ?? null;
  const canAnalyzePhoto = Boolean(image && uploadedImage);
  const canAnalyzeCloset = Boolean(selectedClosetItem && closetItemImageUri);
  const canAnalyze = canAnalyzePhoto || canAnalyzeCloset;

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
        <ScreenHeader title="Check Piece" showBack />

        <View style={{ gap: spacing.xs }}>
          <AppText variant="heroSmall" numberOfLines={3}>
            {params.pieceName ?? 'Check Piece'}
          </AppText>
          <AppText tone="muted">
            Upload a photo or choose from your Closet to check whether this piece works with your selected outfit.
          </AppText>
        </View>

        {/* ── Source selection ─────────────────────────────────────────── */}
        {selectedClosetItem ? (
          /* Closet item selected — show compact item card */
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: 22,
              borderWidth: 1,
              gap: spacing.md,
              padding: spacing.md,
            }}>
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
              <Ionicons color={theme.colors.accent} name="checkmark-circle" size={16} />
              <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
                From Your Closet
              </AppText>
            </View>

            {closetItemImageUri ? (
              <View
                style={{
                  aspectRatio: 4 / 3,
                  backgroundColor: theme.colors.card,
                  borderRadius: 16,
                  overflow: 'hidden',
                }}>
                <Image
                  contentFit="contain"
                  source={{ uri: closetItemImageUri }}
                  style={{ height: '100%', width: '100%' }}
                />
              </View>
            ) : null}

            <AppText style={{ fontFamily: theme.fonts.sansMedium }}>
              {selectedClosetItem.title}
            </AppText>
            {selectedClosetItem.category ? (
              <AppText tone="muted" style={{ fontSize: 13 }}>
                {selectedClosetItem.category}
              </AppText>
            ) : null}

            <Pressable
              onPress={() => setClosetPickerVisible(true)}
              style={{
                alignItems: 'center',
                alignSelf: 'flex-start',
                backgroundColor: theme.colors.subtleSurface,
                borderColor: theme.colors.border,
                borderRadius: 999,
                borderWidth: 1,
                flexDirection: 'row',
                gap: spacing.xs,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              }}>
              <Ionicons color={theme.colors.text} name="swap-horizontal-outline" size={15} />
              <AppText style={{ fontSize: 13 }}>Change item</AppText>
            </Pressable>
          </View>
        ) : (
          /* No closet item — show photo picker */
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
            futureCameraHint="Use your library or capture the piece directly with the camera."
            onPick={handlePhotoPickFromLibrary}
            onTakePhoto={handlePhotoTakePhoto}
            onRemove={() => {
              removeImage();
              setAnalysis(null);
              setAnalysisError(null);
            }}
          />
        )}

        {/* ── From Closet option (shown below photo picker when closet is non-empty) ── */}
        {!selectedClosetItem && closetItems.length > 0 ? (
          <View style={{ alignItems: 'center', gap: spacing.md }}>
            <AppText tone="muted" style={{ fontSize: 12 }}>
              — or —
            </AppText>
            <Pressable
              onPress={() => setClosetPickerVisible(true)}
              style={{
                alignItems: 'center',
                backgroundColor: theme.colors.subtleSurface,
                borderColor: theme.colors.border,
                borderRadius: 999,
                borderWidth: 1,
                flexDirection: 'row',
                gap: spacing.sm,
                justifyContent: 'center',
                minHeight: 48,
                paddingHorizontal: spacing.lg,
              }}>
              <Ionicons color={theme.colors.text} name="shirt-outline" size={16} />
              <AppText>Choose from Closet</AppText>
            </Pressable>
          </View>
        ) : null}

        {/* ── Action buttons ───────────────────────────────────────────── */}
        {canAnalyze ? (
          <View style={{ gap: spacing.sm }}>
            <PrimaryButton
              label={isAnalyzing ? 'Analyzing...' : 'Check this piece'}
              onPress={() => void runAnalysis()}
              disabled={isAnalyzing}
            />
            {/* "Save to Closet" only makes sense for a freshly photographed piece */}
            {canAnalyzePhoto ? (
              <PrimaryButton
                label="Save to Closet"
                onPress={() => setClosetModalVisible(true)}
                variant="secondary"
                disabled={isAnalyzing}
              />
            ) : null}
          </View>
        ) : null}

        {analysisError ? (
          <>
            <ErrorState title="Analysis unavailable" message={analysisError} />
            <PrimaryButton
              label={isAnalyzing ? 'Analyzing...' : 'Retry analysis'}
              onPress={() => void runAnalysis()}
              disabled={isAnalyzing || !canAnalyze}
              variant="secondary"
            />
          </>
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
        ) : null}
      </View>

      {/* Save to Closet modal — for photographed pieces */}
      <SaveToClosetModal
        visible={closetModalVisible}
        onClose={() => setClosetModalVisible(false)}
        onSaved={(_item) => setClosetModalVisible(false)}
        uploadedImage={uploadedImage ?? undefined}
      />

      {/* Closet picker modal — reuses the same component as New Style Brief */}
      <ClosetPickerModal
        visible={closetPickerVisible}
        items={closetItems}
        onSelect={handleClosetItemSelected}
        onClose={() => setClosetPickerVisible(false)}
      />
    </AppScreen>
  );
}
