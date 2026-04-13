import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useUploadedImage } from '@/hooks/use-uploaded-image';
import { loadAppSettings, saveAppSettings } from '@/lib/app-settings-storage';
import type { ClosetItem } from '@/types/closet';
import type { LocalImageAsset, UploadedImageAsset } from '@/types/media';
import { SaveToClosetForm } from './SaveToClosetForm';
import { useSaveToClosetForm } from './useSaveToClosetForm';
import { useSaveToClosetSubmit } from './useSaveToClosetSubmit';

// ── Props ─────────────────────────────────────────────────────────────────────

type SaveToClosetModalContainerProps = {
  visible: boolean;
  onClose: () => void;
  onSaved: (item: ClosetItem) => void;
  uploadedImage?: UploadedImageAsset | null;
  description?: string;
  loadingContext?: boolean;
};

// ── Container ─────────────────────────────────────────────────────────────────

export function SaveToClosetModalContainer({
  visible,
  onClose,
  onSaved,
  uploadedImage: uploadedImageProp,
  description,
  loadingContext,
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
    pickMultipleFromLibrary,
    takePhoto: capturePhoto,
    removeImage,
    uploadImage,
    setImage,
    setUploadedImage: setHookUploadedImage,
  } = useUploadedImage('anchor-item');

  const effectiveUploadedImage = uploadedImageProp ?? hookUploadedImage;
  const displayImageUri = pickedImage?.uri ?? effectiveUploadedImage?.publicUrl ?? null;

  // ── Queue state ────────────────────────────────────────────────────────────
  const [imageQueue, setImageQueue] = useState<LocalImageAsset[]>([]);
  const [queueTotal, setQueueTotal] = useState(0);
  const currentQueueIndex = queueTotal > 0 ? queueTotal - imageQueue.length : 0;
  const isInQueue = queueTotal > 1;

  // ── Layout measurement for dual-image scroll view ──────────────────────────
  const [cellWidth, setCellWidth] = useState(0);

  // ── Sub-hooks ──────────────────────────────────────────────────────────────
  const formHook = useSaveToClosetForm({ visible, effectiveUploadedImage, description });

  const submitHook = useSaveToClosetSubmit({
    onSaveSuccess: handleSaveSuccess,
  });

  // ── Dismissal cleanup ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      setImage(null);
      setHookUploadedImage(null);
      formHook.resetAll();
      submitHook.resetSketchState();
      submitHook.clearSaveError();
      setImageQueue([]);
      setQueueTotal(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── Coordinator: save success (queue advance or close) ─────────────────────
  function handleSaveSuccess(item: ClosetItem) {
    void persistLastUsedSize(formHook.fields.size);
    onSaved(item);

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
          <SaveToClosetForm
            // Image area
            displayImageUri={displayImageUri}
            cellWidth={cellWidth}
            onImageLayout={setCellWidth}
            hasBothImages={hasBothImages}
            sketchImageUrl={submitHook.sketchImageUrl}
            isUploadingImage={isUploadingImage}
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
        </View>
      </View>
    </Modal>
  );
}
