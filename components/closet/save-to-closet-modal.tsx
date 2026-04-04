import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { LoadingState } from '@/components/ui/loading-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing, theme } from '@/constants/theme';
import { useUploadedImage } from '@/hooks/use-uploaded-image';
import { loadAppSettings, saveAppSettings } from '@/lib/app-settings-storage';
import { closetService } from '@/services/closet';
import type { ClosetItem, ClosetItemFitStatus } from '@/types/closet';
import { CLOSET_FIT_STATUS_OPTIONS } from '@/types/closet';
import type { LocalImageAsset, UploadedImageAsset } from '@/types/media';

type SaveToClosetModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Called once per successfully saved item — passes the persisted ClosetItem. */
  onSaved: (item: ClosetItem) => void;
  uploadedImage?: UploadedImageAsset | null;
  description?: string;
};

export function SaveToClosetModal({ visible, onClose, onSaved, uploadedImage, description }: SaveToClosetModalProps) {
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

  const effectiveUploadedImage = uploadedImage ?? hookUploadedImage;
  const displayImageUri = pickedImage?.uri ?? effectiveUploadedImage?.publicUrl ?? null;

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('');
  const [category, setCategory] = useState('');
  const [fitStatus, setFitStatus] = useState<ClosetItemFitStatus | undefined>(undefined);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sketch generation state
  const [isGeneratingSketch, setIsGeneratingSketch] = useState(false);
  const [sketchJobId, setSketchJobId] = useState<string | null>(null);
  const [sketchImageUrl, setSketchImageUrl] = useState<string | null>(null);
  const [sketchError, setSketchError] = useState<string | null>(null);
  const [cellWidth, setCellWidth] = useState(0);
  const sketchTranslateX = useRef(new Animated.Value(-140)).current;

  // ── Multi-select queue ──────────────────────────────────────────────────────
  // imageQueue: remaining assets waiting to be processed (does not include the
  // one currently shown in the modal).
  const [imageQueue, setImageQueue] = useState<LocalImageAsset[]>([]);
  // queueTotal: total number of images selected in this batch (0 = single pick,
  // no progress indicator shown).
  const [queueTotal, setQueueTotal] = useState(0);

  // 1-based index of the item currently being edited.
  // Derived: queueTotal - imageQueue.length (safe when queueTotal > 0).
  const currentQueueIndex = queueTotal > 0 ? queueTotal - imageQueue.length : 0;

  // Pre-fill size from last-used when modal opens
  useEffect(() => {
    if (!visible) return;
    void loadAppSettings().then((settings) => {
      if (settings.lastUsedSize) setSize(settings.lastUsedSize);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Reset form state when modal opens or when the active image changes (queue advance).
  // NOTE: imageQueue / queueTotal are intentionally NOT reset here — they are managed
  // by handlePickFromLibrary, handleSave (queue advance), handleClose, and the
  // !visible cleanup effect below. Resetting them here would wipe the queue every
  // time the uploaded image ID changes (i.e. on every queue advance).
  useEffect(() => {
    if (!visible) return;

    setTitle('');
    setBrand('');
    setCategory('');
    setFitStatus(undefined);
    setSaveError(null);
    setSketchImageUrl(null);
    setSketchJobId(null);
    setSketchError(null);
    setIsGeneratingSketch(false);

    if (!effectiveUploadedImage) return;

    let isMounted = true;
    setIsAnalyzing(true);

    void closetService
      .analyzeItem({
        uploadedImageId: effectiveUploadedImage.id,
        uploadedImageUrl: effectiveUploadedImage.publicUrl,
        description: description ?? '',
      })
      .then((response) => {
        if (!isMounted) return;
        if (response.success && response.data) {
          setTitle(response.data.title);
          setCategory(response.data.category);
          if (response.data.brand) setBrand(response.data.brand);
        }
        setIsAnalyzing(false);
      });

    return () => { isMounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, effectiveUploadedImage?.id, description]);

  // Sketch loading bar animation
  useEffect(() => {
    if (!isGeneratingSketch) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(sketchTranslateX, { toValue: 220, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(sketchTranslateX, { toValue: -140, duration: 0, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [isGeneratingSketch, sketchTranslateX]);

  // Poll for sketch when jobId is set
  useEffect(() => {
    if (!sketchJobId) return;

    const interval = setInterval(() => {
      void closetService.getItemSketch(sketchJobId).then((response) => {
        if (!response.success || !response.data) return;
        if (response.data.sketchStatus === 'ready' && response.data.sketchImageUrl) {
          setSketchImageUrl(response.data.sketchImageUrl);
          setIsGeneratingSketch(false);
          setSketchJobId(null);
        } else if (response.data.sketchStatus === 'failed') {
          setSketchError('Sketch generation failed. You can still save without it.');
          setIsGeneratingSketch(false);
          setSketchJobId(null);
        }
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [sketchJobId]);

  // Clear all local state when modal is dismissed (without server-side deletes —
  // the explicit trash button handles those separately via removeImage()).
  useEffect(() => {
    if (!visible) {
      setImage(null);
      setHookUploadedImage(null);
      setTitle('');
      setBrand('');
      setSize('');
      setCategory('');
      setFitStatus(undefined);
      setSaveError(null);
      setSketchImageUrl(null);
      setSketchJobId(null);
      setSketchError(null);
      setIsGeneratingSketch(false);
      setIsAnalyzing(false);
      setImageQueue([]);
      setQueueTotal(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Persist last-used size after a successful save so future opens pre-fill it
  async function persistLastUsedSize(savedSize: string) {
    if (!savedSize.trim()) return;
    const settings = await loadAppSettings();
    await saveAppSettings({ ...settings, lastUsedSize: savedSize.trim() });
  }

  // Reset all state + delete picked upload (explicit user-initiated photo removal).
  function handleReset() {
    removeImage();
    setTitle('');
    setBrand('');
    setSize('');
    setCategory('');
    setFitStatus(undefined);
    setSaveError(null);
    setSketchImageUrl(null);
    setSketchJobId(null);
    setSketchError(null);
    setIsGeneratingSketch(false);
    setIsAnalyzing(false);
    // If in a queue batch, clear the remaining queue too.
    setImageQueue([]);
    setQueueTotal(0);
  }

  async function handleGenerateSketch() {
    if (!effectiveUploadedImage?.publicUrl) return;
    setSketchError(null);
    setIsGeneratingSketch(true);

    const response = await closetService.generateItemSketch({
      uploadedImageId: effectiveUploadedImage.id,
      uploadedImageUrl: effectiveUploadedImage.publicUrl,
    });

    if (response.success && response.data) {
      setSketchJobId(response.data.jobId);
    } else {
      setSketchError(response.error?.message ?? 'Sketch generation is not available right now.');
      setIsGeneratingSketch(false);
    }
  }

  async function handleSave() {
    if (!title.trim()) return;
    setIsSaving(true);
    setSaveError(null);

    const response = await closetService.saveItem({
      title: title.trim(),
      brand: brand.trim(),
      size: size.trim(),
      category: category.trim() || 'Clothing',
      uploadedImageId: effectiveUploadedImage?.id,
      uploadedImageUrl: effectiveUploadedImage?.publicUrl,
      sketchImageUrl: sketchImageUrl ?? undefined,
      fitStatus,
    });

    setIsSaving(false);

    if (!response.success || !response.data) {
      setSaveError(response.error?.message ?? 'Failed to save item to closet.');
      return;
    }

    void persistLastUsedSize(size);

    // Notify the parent about the saved item (triggers loadItems / scroll logic).
    onSaved(response.data);

    if (imageQueue.length > 0) {
      // ── Advance to next item in the batch ───────────────────────────────────
      const nextAsset = imageQueue[0]!;
      setImageQueue((q) => q.slice(1));

      // Reset form & sketch state for the next item. We deliberately skip
      // server-side upload deletion (the previous item is already saved).
      setHookUploadedImage(null);
      setFitStatus(undefined);
      setSaveError(null);
      setSketchImageUrl(null);
      setSketchJobId(null);
      setSketchError(null);
      setIsGeneratingSketch(false);
      setIsAnalyzing(false);

      // Set the next local image, then upload it.
      // uploadImage will internally clean up the previous upload record and
      // then trigger a new upload; when the upload settles, effectiveUploadedImage
      // changes which fires the analysis useEffect automatically.
      setImage(nextAsset);
      await uploadImage(nextAsset);
    } else {
      // ── Last item (or single pick) — close the modal ────────────────────────
      setQueueTotal(0);
      onClose();
    }
  }

  /**
   * Cancel/close: clears any remaining queue and dismisses the modal.
   * Already-saved items from earlier in the batch are unaffected.
   */
  function handleClose() {
    setImageQueue([]);
    setQueueTotal(0);
    onClose();
  }

  // ── Library multi-select handler ────────────────────────────────────────────
  async function handlePickFromLibrary() {
    const assets = await pickMultipleFromLibrary();
    if (assets.length > 1) {
      // Queue assets 2..n; asset 1 is already being uploaded by the hook.
      setImageQueue(assets.slice(1));
      setQueueTotal(assets.length);
    }
  }

  const hasBothImages = Boolean(sketchImageUrl) && Boolean(displayImageUri);
  const isInQueue = queueTotal > 1;

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={handleClose}>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: 'rgba(24, 18, 14, 0.52)',
            flex: 1,
            justifyContent: 'center',
            padding: spacing.lg,
          }}>
          <View
            style={{
              backgroundColor: '#FFFDFC',
              borderRadius: 28,
              maxWidth: 420,
              width: '100%',
              overflow: 'hidden',
              maxHeight: '92%',
            }}>
            <ScrollView
              automaticallyAdjustKeyboardInsets
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: 320 }}>

              {/* Header */}
              <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
                  <Ionicons color={theme.colors.accent} name="archive-outline" size={18} />
                  <AppText variant="eyebrow" style={{ letterSpacing: 1.8, color: theme.colors.mutedText }}>
                    {isInQueue ? `Item ${currentQueueIndex} of ${queueTotal}` : 'Save to Closet'}
                  </AppText>
                </View>
                <Pressable hitSlop={8} onPress={handleClose}>
                  <Ionicons color={theme.colors.mutedText} name="close" size={22} />
                </Pressable>
              </View>

              {/* Image area */}
              {displayImageUri ? (
                <View style={{ gap: spacing.sm }}>
                  <View style={{ position: 'relative' }}>
                  <View
                    onLayout={(e) => setCellWidth(e.nativeEvent.layout.width)}
                    style={{
                      aspectRatio: 4 / 3,
                      backgroundColor: theme.colors.card,
                      borderRadius: 18,
                      overflow: 'hidden',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    {hasBothImages && cellWidth > 0 ? (
                      <>
                        <ScrollView
                          horizontal
                          pagingEnabled
                          showsHorizontalScrollIndicator={false}
                          style={{ width: cellWidth, flex: 1 }}>
                          <Image contentFit="cover" source={{ uri: sketchImageUrl! }} style={{ width: cellWidth, flex: 1 }} />
                          <Image contentFit="cover" source={{ uri: displayImageUri }} style={{ width: cellWidth, flex: 1 }} />
                        </ScrollView>
                        <View style={{ bottom: 8, flexDirection: 'row', gap: 5, position: 'absolute', alignSelf: 'center' }}>
                          <View style={{ backgroundColor: '#FFF', borderRadius: 999, height: 6, width: 6, opacity: 0.9 }} />
                          <View style={{ backgroundColor: '#FFF', borderRadius: 999, height: 6, width: 6, opacity: 0.45 }} />
                        </View>
                      </>
                    ) : (
                      <Image contentFit="cover" source={{ uri: displayImageUri }} style={{ height: '100%', width: '100%' }} />
                    )}
                  </View>
                  {!uploadedImage ? (
                    <Pressable
                      hitSlop={8}
                      onPress={handleReset}
                      style={{
                        alignItems: 'center',
                        backgroundColor: 'rgba(0,0,0,0.55)',
                        borderRadius: 999,
                        height: 32,
                        justifyContent: 'center',
                        position: 'absolute',
                        right: 8,
                        top: 8,
                        width: 32,
                      }}>
                      <Ionicons color="#FFF" name="trash-outline" size={15} />
                    </Pressable>
                  ) : null}
                  </View>

                  {/* Sketch generation */}
                  {isGeneratingSketch ? (
                    <View
                      style={{
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                        borderRadius: 16,
                        borderWidth: 1,
                        padding: spacing.md,
                        gap: spacing.sm,
                        alignItems: 'center',
                      }}>
                      <View style={{ backgroundColor: theme.colors.border, borderRadius: 999, height: 8, overflow: 'hidden', width: '100%' }}>
                        <Animated.View
                          style={{
                            backgroundColor: theme.colors.accent,
                            borderRadius: 999,
                            height: '100%',
                            transform: [{ translateX: sketchTranslateX }],
                            width: 140,
                          }}
                        />
                      </View>
                      <AppText tone="muted" style={{ fontSize: 13 }}>Generating sketch...</AppText>
                    </View>
                  ) : sketchImageUrl ? (
                    <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
                      <Ionicons color={theme.colors.accent} name="checkmark-circle-outline" size={16} />
                      <AppText tone="muted" style={{ fontSize: 12 }}>Sketch ready — swipe left to see original photo</AppText>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => void handleGenerateSketch()}
                      style={{
                        alignItems: 'center',
                        backgroundColor: theme.colors.subtleSurface,
                        borderColor: theme.colors.border,
                        borderRadius: 999,
                        borderWidth: 1,
                        flexDirection: 'row',
                        gap: spacing.sm,
                        justifyContent: 'center',
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                      }}>
                      <Ionicons color={theme.colors.accent} name="color-wand-outline" size={16} />
                      <AppText variant="eyebrow" style={{ color: theme.colors.accent, letterSpacing: 1.4 }}>
                        Generate Sketch
                      </AppText>
                    </Pressable>
                  )}

                  {sketchError ? (
                    <AppText style={{ color: '#D26A5C', fontSize: 12 }}>{sketchError}</AppText>
                  ) : null}
                </View>
              ) : !uploadedImage ? (
                /* No pre-supplied image — let user pick one */
                <View style={{ gap: spacing.sm }}>
                  {isUploadingImage ? (
                    <View
                      style={{
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                        borderRadius: 16,
                        borderWidth: 1,
                        padding: spacing.md,
                        gap: spacing.sm,
                        alignItems: 'center',
                      }}>
                      <AppText tone="muted" style={{ fontSize: 13 }}>Uploading photo...</AppText>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      {/* Library — multi-select, independent opening state */}
                      <Pressable
                        disabled={isPicking}
                        onPress={() => void handlePickFromLibrary()}
                        style={{
                          alignItems: 'center',
                          backgroundColor: theme.colors.subtleSurface,
                          borderColor: theme.colors.border,
                          borderRadius: 999,
                          borderWidth: 1,
                          flex: 1,
                          flexDirection: 'row',
                          gap: spacing.xs,
                          justifyContent: 'center',
                          minHeight: 48,
                          opacity: isPicking ? 0.5 : 1,
                          paddingHorizontal: spacing.md,
                        }}>
                        <Ionicons color={theme.colors.text} name="image-outline" size={16} />
                        <AppText>{isPickingLibrary ? 'Opening...' : 'Library'}</AppText>
                      </Pressable>

                      {/* Camera — single-select with editing, independent opening state */}
                      <Pressable
                        disabled={isPicking}
                        onPress={() => void capturePhoto()}
                        style={{
                          alignItems: 'center',
                          backgroundColor: theme.colors.subtleSurface,
                          borderColor: theme.colors.border,
                          borderRadius: 999,
                          borderWidth: 1,
                          flex: 1,
                          flexDirection: 'row',
                          gap: spacing.xs,
                          justifyContent: 'center',
                          minHeight: 48,
                          opacity: isPicking ? 0.5 : 1,
                          paddingHorizontal: spacing.md,
                        }}>
                        <Ionicons color={theme.colors.text} name="camera-outline" size={16} />
                        <AppText>{isPickingCamera ? 'Opening...' : 'Camera'}</AppText>
                      </Pressable>
                    </View>
                  )}
                </View>
              ) : null}

              {isAnalyzing ? (
                <LoadingState
                  label="Identifying piece..."
                  messages={['Identifying your piece.', 'Checking the fabric situation.', 'Cataloguing with intention.']}
                />
              ) : (
                <View style={{ gap: spacing.md }}>
                  <View style={{ gap: spacing.xs }}>
                    <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Title</AppText>
                    <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Navy Slim Trousers" placeholderTextColor={theme.colors.subtleText} returnKeyType="next" style={inputStyle} />
                  </View>

                  <View style={{ gap: spacing.xs }}>
                    <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Category</AppText>
                    <TextInput value={category} onChangeText={setCategory} placeholder="e.g. Trousers" placeholderTextColor={theme.colors.subtleText} returnKeyType="next" style={inputStyle} />
                  </View>

                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Brand</AppText>
                      <TextInput value={brand} onChangeText={setBrand} placeholder="e.g. COS" placeholderTextColor={theme.colors.subtleText} returnKeyType="next" style={inputStyle} />
                    </View>
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Size</AppText>
                      <TextInput value={size} onChangeText={setSize} placeholder="e.g. M / 32" placeholderTextColor={theme.colors.subtleText} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} style={inputStyle} />
                    </View>
                  </View>

                  <View style={{ gap: spacing.xs }}>
                    <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>How It Fits</AppText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs, paddingVertical: 2 }}>
                      {CLOSET_FIT_STATUS_OPTIONS.map((opt) => (
                        <Pressable
                          key={opt.value}
                          onPress={() => setFitStatus(fitStatus === opt.value ? undefined : opt.value)}
                          style={{
                            backgroundColor: fitStatus === opt.value ? theme.colors.accent : theme.colors.surface,
                            borderColor: fitStatus === opt.value ? theme.colors.accent : theme.colors.border,
                            borderRadius: 999,
                            borderWidth: 1,
                            paddingHorizontal: spacing.md,
                            paddingVertical: spacing.xs,
                          }}>
                          <AppText style={{ color: fitStatus === opt.value ? '#FFF' : theme.colors.text, fontSize: 13 }}>
                            {opt.label}
                          </AppText>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>

                  {saveError ? <AppText style={{ color: '#D26A5C', fontSize: 13 }}>{saveError}</AppText> : null}

                  <PrimaryButton
                    label={isSaving ? 'Saving...' : 'Save to Closet'}
                    onPress={() => void handleSave()}
                    disabled={isSaving || !title.trim()}
                  />
                  <PrimaryButton
                    label={isInQueue ? 'Cancel Remaining' : 'Cancel'}
                    onPress={handleClose}
                    variant="secondary"
                  />
                </View>
              )}
            </ScrollView>
          </View>
        </View>
    </Modal>
  );
}

const inputStyle = {
  backgroundColor: theme.colors.surface,
  borderColor: theme.colors.border,
  borderRadius: 14,
  borderWidth: 1,
  color: theme.colors.text,
  fontFamily: theme.fonts.sans,
  fontSize: 15,
  minHeight: 48,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
} as const;
