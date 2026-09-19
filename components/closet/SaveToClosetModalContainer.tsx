import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useUploadedImage } from '@/hooks/use-uploaded-image';
import { loadAppSettings, saveAppSettings } from '@/lib/app-settings-storage';
import type { ClosetItem } from '@/types/closet';
import type { UserFragrance } from '@/types/fragrance';
import type { LocalImageAsset, UploadedImageAsset } from '@/types/media';
import { SaveToClosetForm } from './SaveToClosetForm';
import { useSaveToClosetForm } from './useSaveToClosetForm';
import { useSaveToClosetSubmit } from './useSaveToClosetSubmit';
import { useItemKindDetection, type ItemKind } from './useItemKindDetection';
import { SaveFragranceForm } from './fragrance/SaveFragranceForm';
import { useFragranceForm } from './fragrance/useFragranceForm';
import { useFragranceSubmit } from './fragrance/useFragranceSubmit';

// ── Props ─────────────────────────────────────────────────────────────────────

type SaveToClosetModalContainerProps = {
  visible: boolean;
  onClose: () => void;
  onSaved: (item: ClosetItem) => void;
  /** Only relevant on surfaces that track a fragrance list (currently: the Closet screen's Fragrances tab) — omit elsewhere. */
  onFragranceSaved?: (item: UserFragrance) => void;
  uploadedImage?: UploadedImageAsset | null;
  description?: string;
  loadingContext?: boolean;
  /** Which mode the modal opens in — explicit manual selection (e.g. the Fragrances tab's own "+" button). Defaults to garment; AI auto-detection can still switch it once a photo is uploaded, and the user can always correct via the in-form toggle. */
  initialItemKind?: ItemKind;
};

// ── Container ─────────────────────────────────────────────────────────────────

export function SaveToClosetModalContainer({
  visible,
  onClose,
  onSaved,
  onFragranceSaved,
  uploadedImage: uploadedImageProp,
  description,
  loadingContext,
  initialItemKind = 'garment',
}: SaveToClosetModalContainerProps) {
  const { theme } = useTheme();

  // ── Image picker hook ──────────────────────────────────────────────────────
  const {
    image: pickedImage,
    uploadedImage: hookUploadedImage,
    isPicking,
    isPickingLibrary,
    isPickingCamera,
    isUploading: isUploadingImage,
    uploadProgress,
    error: uploadError,
    pickMultipleFromLibrary,
    takePhoto: capturePhoto,
    removeImage,
    uploadImage,
    setImage,
    setUploadedImage: setHookUploadedImage,
  } = useUploadedImage('anchor-item');

  const effectiveUploadedImage = uploadedImageProp ?? hookUploadedImage;
  const displayImageUri = pickedImage?.uri ?? effectiveUploadedImage?.publicUrl ?? null;
  // True when the user picked a local image but no successful upload exists yet.
  // Saving in this state would persist a record without an originalImageUrl.
  const isOriginalPhotoPending = Boolean(pickedImage) && !effectiveUploadedImage;

  function handleRetryUpload() {
    if (pickedImage) void uploadImage(pickedImage);
  }

  // ── Queue state ────────────────────────────────────────────────────────────
  const [imageQueue, setImageQueue] = useState<LocalImageAsset[]>([]);
  const [queueTotal, setQueueTotal] = useState(0);
  const currentQueueIndex = queueTotal > 0 ? queueTotal - imageQueue.length : 0;
  const isInQueue = queueTotal > 1;

  // ── Layout measurement for dual-image scroll view ──────────────────────────
  const [cellWidth, setCellWidth] = useState(0);

  // ── Item kind (garment vs fragrance) ────────────────────────────────────────
  const itemKindDetection = useItemKindDetection({ initialItemKind });

  // ── Sub-hooks ──────────────────────────────────────────────────────────────
  const formHook = useSaveToClosetForm({ visible, effectiveUploadedImage, description });

  const submitHook = useSaveToClosetSubmit({
    onSaveSuccess: handleSaveSuccess,
  });

  const fragranceFormHook = useFragranceForm({ visible });
  const fragranceSubmitHook = useFragranceSubmit({ onSaveSuccess: handleFragranceSaveSuccess });

  // Best-effort garment-vs-fragrance detection once a fresh photo finishes
  // uploading — never blocks the garment path, only offers an auto-switch or
  // (below confidence) leaves the mode as-is for the user to correct manually.
  useEffect(() => {
    if (effectiveUploadedImage) void itemKindDetection.detectFromImage(effectiveUploadedImage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUploadedImage?.id]);

  // ── Dismissal cleanup ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      setImage(null);
      setHookUploadedImage(null);
      formHook.resetAll();
      submitHook.resetSketchState();
      submitHook.clearSaveError();
      fragranceFormHook.resetFields();
      fragranceSubmitHook.clearSaveError();
      itemKindDetection.reset(initialItemKind);
      setImageQueue([]);
      setQueueTotal(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── Coordinator: save success (queue advance or close) ─────────────────────
  function handleSaveSuccess(item: ClosetItem) {
    void persistLastUsedSize(formHook.fields.size);
    onSaved(item);
    advanceQueueOrClose();
  }

  function handleFragranceSaveSuccess(item: UserFragrance) {
    onFragranceSaved?.(item);
    advanceQueueOrClose();
  }

  function advanceQueueOrClose() {
    if (imageQueue.length > 0) {
      const nextAsset = imageQueue[0]!;
      setImageQueue((q) => q.slice(1));
      void handleQueueAdvance(nextAsset);
    } else {
      setQueueTotal(0);
      onClose();
    }
  }

  async function handleQueueAdvance(nextAsset: LocalImageAsset) {
    formHook.resetFields();
    submitHook.resetSketchState();
    submitHook.clearSaveError();
    fragranceFormHook.resetFields();
    fragranceSubmitHook.clearSaveError();
    itemKindDetection.reset(initialItemKind);
    setImage(nextAsset);
    await uploadImage(nextAsset);
  }

  async function persistLastUsedSize(savedSize: string) {
    if (!savedSize.trim()) return;
    const settings = await loadAppSettings();
    await saveAppSettings({ ...settings, lastUsedSize: savedSize.trim() });
  }

  // ── Coordinator: pick from library (multi-select + queue setup) ────────────
  async function handlePickFromLibrary() {
    const assets = await pickMultipleFromLibrary();
    if (assets.length > 1) {
      setImageQueue(assets.slice(1));
      setQueueTotal(assets.length);
    }
  }

  // ── Coordinator: reset (trash button) ─────────────────────────────────────
  function handleReset() {
    removeImage();
    formHook.resetAll();
    submitHook.resetSketchState();
    submitHook.clearSaveError();
    fragranceFormHook.resetFields();
    fragranceSubmitHook.clearSaveError();
    itemKindDetection.reset(initialItemKind);
    setImageQueue([]);
    setQueueTotal(0);
  }

  // ── Coordinator: close ─────────────────────────────────────────────────────
  function handleClose() {
    setImageQueue([]);
    setQueueTotal(0);
    onClose();
  }

  const hasBothImages = Boolean(submitHook.sketchImageUrl) && Boolean(displayImageUri);

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={handleClose}>
      {/* Backdrop — absolute so it never competes with ScrollView or PanResponder inside the card */}
      <Pressable onPress={handleClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <View pointerEvents="none" style={{ flex: 1, backgroundColor: theme.colors.overlay }} />
      </Pressable>

      {/* Centering shell — pointerEvents="box-none" so taps pass through to the backdrop above */}
      <View pointerEvents="box-none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: 28,
            maxWidth: 420,
            width: '100%',
            overflow: 'hidden',
            maxHeight: '92%',
          }}>
          {itemKindDetection.itemKind === 'fragrance' ? (
            <SaveFragranceForm
              // Image area
              displayImageUri={displayImageUri}
              isUploadingImage={isUploadingImage}
              uploadProgress={uploadProgress}
              uploadError={uploadError}
              isOriginalPhotoPending={isOriginalPhotoPending}
              onRetryUpload={handleRetryUpload}
              isPicking={isPicking}
              isPickingLibrary={isPickingLibrary}
              isPickingCamera={isPickingCamera}
              onPickFromLibrary={() => void handlePickFromLibrary()}
              onCapturePhoto={() => void capturePhoto()}
              onReset={handleReset}
              // Identify
              isIdentifying={fragranceFormHook.isIdentifying}
              identifyError={fragranceFormHook.identifyError}
              needsReview={fragranceFormHook.needsReview}
              onIdentify={() => {
                if (effectiveUploadedImage) void fragranceFormHook.handleIdentify(effectiveUploadedImage);
              }}
              // Sketch
              isGeneratingSketch={fragranceFormHook.isGeneratingSketch}
              sketchImageUrl={fragranceFormHook.sketchImageUrl}
              sketchTranslateX={fragranceFormHook.sketchTranslateX}
              sketchError={fragranceFormHook.sketchError}
              // Form fields
              fields={fragranceFormHook.fields}
              setBrand={fragranceFormHook.setters.setBrand}
              setName={fragranceFormHook.setters.setName}
              setConcentration={fragranceFormHook.setters.setConcentration}
              setAccordNames={fragranceFormHook.setters.setAccordNames}
              setPrimaryVibe={fragranceFormHook.setters.setPrimaryVibe}
              setSecondaryVibes={fragranceFormHook.setters.setSecondaryVibes}
              setSeasons={fragranceFormHook.setters.setSeasons}
              setDayNight={fragranceFormHook.setters.setDayNight}
              setFormalityTags={fragranceFormHook.setters.setFormalityTags}
              setIsSignature={fragranceFormHook.setters.setIsSignature}
              setCurrentVolumeMl={fragranceFormHook.setters.setCurrentVolumeMl}
              setUserNotes={fragranceFormHook.setters.setUserNotes}
              // Save
              isSaving={fragranceSubmitHook.isSaving}
              saveError={fragranceSubmitHook.saveError}
              onSave={() =>
                void fragranceSubmitHook.handleSave(
                  fragranceFormHook.fields,
                  fragranceFormHook.resolvedFragrance,
                  effectiveUploadedImage,
                  fragranceFormHook.sketchImageUrl,
                )
              }
              onClose={handleClose}
              onSwitchToGarment={() => itemKindDetection.setItemKind('garment')}
            />
          ) : (
            <>
              {/* Manual mode switch — kept outside SaveToClosetForm so the garment form's own JSX stays untouched. Reachable regardless of detection state; wording adapts when a confident (but not auto-switched) fragrance guess exists. */}
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
                <Pressable onPress={() => itemKindDetection.setItemKind('fragrance')} hitSlop={6}>
                  <AppText tone="muted" style={{ fontSize: 12, textDecorationLine: 'underline' }}>
                    {itemKindDetection.detected?.kind === 'fragrance'
                      ? 'Looks like a fragrance bottle — tap to switch'
                      : 'Adding a fragrance instead?'}
                  </AppText>
                </Pressable>
              </View>
              <SaveToClosetForm
              // Image area
              displayImageUri={displayImageUri}
              cellWidth={cellWidth}
              onImageLayout={setCellWidth}
              hasBothImages={hasBothImages}
              sketchImageUrl={submitHook.sketchImageUrl}
              isUploadingImage={isUploadingImage}
              uploadProgress={uploadProgress}
              uploadError={uploadError}
              isOriginalPhotoPending={isOriginalPhotoPending}
              onRetryUpload={handleRetryUpload}
              isPicking={isPicking}
              isPickingLibrary={isPickingLibrary}
              isPickingCamera={isPickingCamera}
              uploadedImageProp={uploadedImageProp}
              loadingContext={loadingContext}
              // Queue
              isInQueue={isInQueue}
              currentQueueIndex={currentQueueIndex}
              queueTotal={queueTotal}
              // Async / error
              isAnalyzing={formHook.isAnalyzing}
              isSaving={submitHook.isSaving}
              isGeneratingSketch={submitHook.isGeneratingSketch}
              sketchTranslateX={submitHook.sketchTranslateX}
              sketchError={submitHook.sketchError}
              saveError={submitHook.saveError}
              // Form fields
              fields={formHook.fields}
              setTitle={formHook.setters.setTitle}
              setBrand={formHook.setters.setBrand}
              setSize={formHook.setters.setSize}
              setCategory={formHook.setters.setCategory}
              setSubcategory={formHook.setters.setSubcategory}
              setPrimaryColor={formHook.setters.setPrimaryColor}
              setMaterial={formHook.setters.setMaterial}
              setNotes={formHook.setters.setNotes}
              setColorFamily={formHook.setters.setColorFamily}
              setSilhouette={formHook.setters.setSilhouette}
              setFitStatus={formHook.setters.setFitStatus}
              setFormality={formHook.setters.setFormality}
              setWeight={formHook.setters.setWeight}
              setPattern={formHook.setters.setPattern}
              setSeason={formHook.setters.setSeason}
              setLensShape={formHook.setters.setLensShape}
              setFrameColor={formHook.setters.setFrameColor}
              // Handlers
              onPickFromLibrary={() => void handlePickFromLibrary()}
              onCapturePhoto={() => void capturePhoto()}
              onReset={handleReset}
              onAIAutofill={() => void formHook.handleAIAutofill()}
              onGenerateSketch={() => {
                if (effectiveUploadedImage) void submitHook.handleGenerateSketch(effectiveUploadedImage, formHook.fields);
              }}
              onSave={() => void submitHook.handleSave(formHook.fields, effectiveUploadedImage)}
              onClose={handleClose}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
