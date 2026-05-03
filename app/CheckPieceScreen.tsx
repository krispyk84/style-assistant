import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';

import { MockAnalysisCard } from '@/components/cards/mock-analysis-card';
import { ClosetPickerModal } from '@/components/closet/closet-picker-modal';
import { SaveToClosetModal } from '@/components/closet/save-to-closet-modal';
import { ImagePickerField } from '@/components/forms/image-picker-field';
import { AppIcon } from '@/components/ui/app-icon';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { ErrorState } from '@/components/ui/error-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { spacing, theme } from '@/constants/theme';
import type { ClosetItem } from '@/types/closet';
import { CheckPieceClosetItemPreview } from './CheckPieceClosetItemPreview';
import { useCheckPieceAnalysis } from './useCheckPieceAnalysis';
import { useCheckPieceImage } from './useCheckPieceImage';
import { useCheckPieceSave } from './useCheckPieceSave';

// ── Screen ─────────────────────────────────────────────────────────────────────

export function CheckPieceScreen() {
  const params = useLocalSearchParams<{
    requestId?: string;
    tier?: string;
    outfitTitle?: string;
    anchorItemDescription?: string;
    pieceName?: string;
  }>();

  const imageHook = useCheckPieceImage();
  const analysisHook = useCheckPieceAnalysis();
  const saveHook = useCheckPieceSave();

  // ── Coordinator functions ──────────────────────────────────────────────────
  // These call across hook boundaries, so they live in the screen.

  function handleClosetItemSelected(item: ClosetItem) {
    // Clear any photo that was previously picked
    if (imageHook.image) imageHook.removeImage();
    imageHook.setSelectedClosetItem(item);
    analysisHook.clearAnalysis();
    imageHook.setClosetPickerVisible(false);
  }

  function handlePhotoPickFromLibrary() {
    imageHook.clearClosetSelection();
    analysisHook.clearAnalysis();
    void imageHook.pickFromLibrary();
  }

  function handlePhotoTakePhoto() {
    imageHook.clearClosetSelection();
    analysisHook.clearAnalysis();
    void imageHook.takePhoto();
  }

  function triggerAnalysis() {
    void analysisHook.runAnalysis({
      image: imageHook.image,
      uploadedImage: imageHook.uploadedImage,
      selectedClosetItem: imageHook.selectedClosetItem,
      params,
    });
  }

  // ── Derived state ──────────────────────────────────────────────────────────
  const closetItemImageUri =
    imageHook.selectedClosetItem?.uploadedImageUrl ??
    imageHook.selectedClosetItem?.sketchImageUrl ??
    null;
  // Analysis from photo requires upload to be complete (uploadedImage non-null)
  const canAnalyzePhoto = Boolean(imageHook.image && imageHook.uploadedImage);
  const canAnalyzeCloset = Boolean(imageHook.selectedClosetItem && closetItemImageUri);
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
        {imageHook.selectedClosetItem ? (
          <CheckPieceClosetItemPreview
            closetItem={imageHook.selectedClosetItem}
            onChangePress={() => imageHook.setClosetPickerVisible(true)}
          />
        ) : (
          <ImagePickerField
            image={imageHook.image}
            isPicking={imageHook.isPicking || imageHook.isUploading}
            error={imageHook.error}
            statusMessage={
              imageHook.isUploading
                ? `Uploading ${Math.round(imageHook.uploadProgress * 100)}%`
                : imageHook.uploadedImage
                  ? imageHook.uploadSuccessMessage ?? 'Upload complete.'
                  : null
            }
            pickLabel={imageHook.isUploading ? `Uploading ${Math.round(imageHook.uploadProgress * 100)}%` : 'Choose from library'}
            cameraLabel="Take photo"
            futureCameraHint="Use your library or capture the piece directly with the camera."
            onPick={handlePhotoPickFromLibrary}
            onTakePhoto={handlePhotoTakePhoto}
            onRemove={() => {
              imageHook.removeImage();
              analysisHook.clearAnalysis();
            }}
          />
        )}

        {/* ── From Closet option (shown below photo picker when closet is non-empty) ── */}
        {!imageHook.selectedClosetItem && imageHook.closetItems.length > 0 ? (
          <View style={{ alignItems: 'center', gap: spacing.md }}>
            <AppText tone="muted" style={{ fontSize: 12 }}>
              — or —
            </AppText>
            <Pressable
              onPress={() => imageHook.setClosetPickerVisible(true)}
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
              <AppIcon color={theme.colors.text} name="shirt" size={16} />
              <AppText>Choose from Closet</AppText>
            </Pressable>
          </View>
        ) : null}

        {/* ── Action buttons ───────────────────────────────────────────── */}
        {canAnalyze ? (
          <View style={{ gap: spacing.sm }}>
            <PrimaryButton
              label={analysisHook.isAnalyzing ? 'Analyzing...' : 'Check this piece'}
              onPress={triggerAnalysis}
              disabled={analysisHook.isAnalyzing}
            />
            {/* "Save to Closet" only makes sense for a freshly photographed piece */}
            {canAnalyzePhoto ? (
              <PrimaryButton
                label="Save to Closet"
                onPress={saveHook.openClosetModal}
                variant="secondary"
                disabled={analysisHook.isAnalyzing}
              />
            ) : null}
          </View>
        ) : null}

        {analysisHook.analysisError ? (
          <>
            <ErrorState title="Analysis unavailable" message={analysisHook.analysisError} />
            <PrimaryButton
              label={analysisHook.isAnalyzing ? 'Analyzing...' : 'Retry analysis'}
              onPress={triggerAnalysis}
              disabled={analysisHook.isAnalyzing || !canAnalyze}
              variant="secondary"
            />
          </>
        ) : null}

        {analysisHook.analysis ? (
          <>
            <MockAnalysisCard
              title={params.pieceName ? `${params.pieceName} verdict` : 'Candidate piece verdict'}
              response={analysisHook.analysis}
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
        visible={saveHook.closetModalVisible}
        onClose={saveHook.closeClosetModal}
        onSaved={saveHook.closeClosetModal}
        uploadedImage={imageHook.uploadedImage ?? undefined}
      />

      {/* Closet picker modal — reuses the same component as New Style Brief */}
      <ClosetPickerModal
        visible={imageHook.closetPickerVisible}
        items={imageHook.closetItems}
        onSelect={handleClosetItemSelected}
        onClose={() => imageHook.setClosetPickerVisible(false)}
      />
    </AppScreen>
  );
}

export { CheckPieceScreen as default };
