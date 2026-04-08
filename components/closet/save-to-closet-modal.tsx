import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { FitStatusPicker } from '@/components/closet/fit-status-picker';
import { LoadingState } from '@/components/ui/loading-state';
import { PillPicker } from '@/components/closet/pill-picker';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SilhouettePicker } from '@/components/closet/silhouette-picker';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useUploadedImage } from '@/hooks/use-uploaded-image';
import { loadAppSettings, saveAppSettings } from '@/lib/app-settings-storage';
import { closetService } from '@/services/closet';
import {
  CLOSET_COLOR_FAMILY_OPTIONS,
  CLOSET_FORMALITY_OPTIONS,
  CLOSET_PATTERN_OPTIONS,
  CLOSET_SEASON_OPTIONS,
  CLOSET_WEIGHT_OPTIONS,
  type ClosetItemColorFamily,
  type ClosetItemFitStatus,
  type ClosetItemSilhouette,
} from '@/types/closet';
import type { ClosetItem } from '@/types/closet';
import type { LocalImageAsset, UploadedImageAsset } from '@/types/media';
import { trackClosetItemAdded } from '@/lib/analytics';

type SaveToClosetModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Called once per successfully saved item — passes the persisted ClosetItem. */
  onSaved: (item: ClosetItem) => void;
  uploadedImage?: UploadedImageAsset | null;
  description?: string;
};

export function SaveToClosetModal({ visible, onClose, onSaved, uploadedImage, description }: SaveToClosetModalProps) {
  const { theme } = useTheme();

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

  // Core fields
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('');
  const [category, setCategory] = useState('');
  const [silhouette, setSilhouette] = useState<ClosetItemSilhouette | undefined>();
  const [fitStatus, setFitStatus] = useState<ClosetItemFitStatus | undefined>();

  // AI-fillable metadata fields (all editable by user)
  const [subcategory, setSubcategory] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [colorFamily, setColorFamily] = useState<ClosetItemColorFamily | undefined>();
  const [material, setMaterial] = useState('');
  const [formality, setFormality] = useState<string | undefined>();
  const [weight, setWeight] = useState<string | undefined>();
  const [pattern, setPattern] = useState<string | undefined>();
  const [season, setSeason] = useState<string | undefined>();
  const [notes, setNotes] = useState('');

  const [saveError, setSaveError] = useState<string | null>(null);

  // Sketch generation state
  const [isGeneratingSketch, setIsGeneratingSketch] = useState(false);
  const [sketchJobId, setSketchJobId] = useState<string | null>(null);
  const [sketchImageUrl, setSketchImageUrl] = useState<string | null>(null);
  const [sketchError, setSketchError] = useState<string | null>(null);
  const [cellWidth, setCellWidth] = useState(0);
  const sketchTranslateX = useRef(new Animated.Value(-140)).current;

  // ── Multi-select queue ──────────────────────────────────────────────────────
  const [imageQueue, setImageQueue] = useState<LocalImageAsset[]>([]);
  const [queueTotal, setQueueTotal] = useState(0);

  const currentQueueIndex = queueTotal > 0 ? queueTotal - imageQueue.length : 0;

  // Pre-fill size from last-used when modal opens
  useEffect(() => {
    if (!visible) return;
    void loadAppSettings().then((settings) => {
      if (settings.lastUsedSize) setSize(settings.lastUsedSize);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Reset form state when modal opens or when the active image changes (queue advance)
  useEffect(() => {
    if (!visible) return;

    setTitle('');
    setBrand('');
    setCategory('');
    setSilhouette(undefined);
    setFitStatus(undefined);
    setSubcategory('');
    setPrimaryColor('');
    setColorFamily(undefined);
    setMaterial('');
    setFormality(undefined);
    setWeight(undefined);
    setPattern(undefined);
    setSeason(undefined);
    setNotes('');
    setSaveError(null);
    setSketchImageUrl(null);
    setSketchJobId(null);
    setSketchError(null);
    setIsGeneratingSketch(false);
    setIsAnalyzing(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, effectiveUploadedImage?.id]);

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

  // Clear all local state when modal is dismissed
  useEffect(() => {
    if (!visible) {
      setImage(null);
      setHookUploadedImage(null);
      setTitle('');
      setBrand('');
      setSize('');
      setCategory('');
      setSilhouette(undefined);
      setFitStatus(undefined);
      setSubcategory('');
      setPrimaryColor('');
      setColorFamily(undefined);
      setMaterial('');
      setFormality(undefined);
      setWeight(undefined);
      setPattern(undefined);
      setSeason(undefined);
      setNotes('');
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

  async function persistLastUsedSize(savedSize: string) {
    if (!savedSize.trim()) return;
    const settings = await loadAppSettings();
    await saveAppSettings({ ...settings, lastUsedSize: savedSize.trim() });
  }

  function handleReset() {
    removeImage();
    setTitle('');
    setBrand('');
    setSize('');
    setCategory('');
    setSilhouette(undefined);
    setFitStatus(undefined);
    setSubcategory('');
    setPrimaryColor('');
    setColorFamily(undefined);
    setMaterial('');
    setFormality(undefined);
    setWeight(undefined);
    setPattern(undefined);
    setSeason(undefined);
    setNotes('');
    setSaveError(null);
    setSketchImageUrl(null);
    setSketchJobId(null);
    setSketchError(null);
    setIsGeneratingSketch(false);
    setIsAnalyzing(false);
    setImageQueue([]);
    setQueueTotal(0);
  }

  async function handleAIAutofill() {
    if (!effectiveUploadedImage) return;
    setIsAnalyzing(true);

    const response = await closetService.analyzeItem({
      uploadedImageId: effectiveUploadedImage.id,
      uploadedImageUrl: effectiveUploadedImage.publicUrl,
      description: description ?? '',
    });

    setIsAnalyzing(false);

    if (response.success && response.data) {
      const d = response.data;
      if (d.title) setTitle(d.title);
      if (d.category) setCategory(d.category);
      if (d.brand) setBrand(d.brand);
      if (d.silhouette) setSilhouette(d.silhouette as ClosetItemSilhouette);
      if (d.subcategory) setSubcategory(d.subcategory);
      if (d.primaryColor) setPrimaryColor(d.primaryColor);
      if (d.colorFamily) setColorFamily(d.colorFamily as ClosetItemColorFamily);
      if (d.material) setMaterial(d.material);
      if (d.formality) setFormality(d.formality);
      if (d.weight) setWeight(d.weight);
      if (d.pattern) setPattern(d.pattern);
    }
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
      silhouette,
      fitStatus,
      subcategory: subcategory.trim() || undefined,
      primaryColor: primaryColor.trim() || undefined,
      colorFamily: colorFamily ?? undefined,
      material: material.trim() || undefined,
      formality: formality ?? undefined,
      weight: weight ?? undefined,
      pattern: pattern ?? undefined,
      season: season ?? undefined,
      notes: notes.trim() || undefined,
    });

    setIsSaving(false);

    if (!response.success || !response.data) {
      setSaveError(response.error?.message ?? 'Failed to save item to closet.');
      return;
    }

    void persistLastUsedSize(size);
    trackClosetItemAdded({ category: category.trim() || 'Clothing' });
    onSaved(response.data);

    if (imageQueue.length > 0) {
      const nextAsset = imageQueue[0]!;
      setImageQueue((q) => q.slice(1));

      setHookUploadedImage(null);
      setSilhouette(undefined);
      setFitStatus(undefined);
      setSubcategory('');
      setPrimaryColor('');
      setColorFamily(undefined);
      setMaterial('');
      setFormality(undefined);
      setWeight(undefined);
      setPattern(undefined);
      setSeason(undefined);
      setNotes('');
      setSaveError(null);
      setSketchImageUrl(null);
      setSketchJobId(null);
      setSketchError(null);
      setIsGeneratingSketch(false);
      setIsAnalyzing(false);

      setImage(nextAsset);
      await uploadImage(nextAsset);
    } else {
      setQueueTotal(0);
      onClose();
    }
  }

  function handleClose() {
    setImageQueue([]);
    setQueueTotal(0);
    onClose();
  }

  async function handlePickFromLibrary() {
    const assets = await pickMultipleFromLibrary();
    if (assets.length > 1) {
      setImageQueue(assets.slice(1));
      setQueueTotal(assets.length);
    }
  }

  const hasBothImages = Boolean(sketchImageUrl) && Boolean(displayImageUri);
  const isInQueue = queueTotal > 1;

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

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={handleClose}>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.overlay,
            flex: 1,
            justifyContent: 'center',
            padding: spacing.lg,
          }}>
          <View
            style={{
              backgroundColor: theme.colors.surface,
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

                  {/* AI Autofill button */}
                  {isAnalyzing ? (
                    <LoadingState
                      label="Identifying piece..."
                      messages={['Identifying your piece.', 'Checking the fabric situation.', 'Cataloguing with intention.']}
                    />
                  ) : (
                    <Pressable
                      onPress={() => void handleAIAutofill()}
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
                      <Ionicons color={theme.colors.accent} name="sparkles-outline" size={16} />
                      <AppText variant="eyebrow" style={{ color: theme.colors.accent, letterSpacing: 1.4 }}>
                        AI Autofill
                      </AppText>
                    </Pressable>
                  )}

                  {sketchError ? (
                    <AppText style={{ color: theme.colors.danger, fontSize: 12 }}>{sketchError}</AppText>
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

              {/* Form fields */}
              <View style={{ gap: spacing.md }}>
                <View style={{ gap: spacing.xs }}>
                  <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Title</AppText>
                  <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Navy Slim Trousers" placeholderTextColor={theme.colors.subtleText} returnKeyType="next" style={inputStyle} />
                </View>

                <View style={{ gap: spacing.xs }}>
                  <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Category</AppText>
                  <TextInput value={category} onChangeText={setCategory} placeholder="e.g. Trousers" placeholderTextColor={theme.colors.subtleText} returnKeyType="next" style={inputStyle} />
                </View>

                <View style={{ gap: spacing.xs }}>
                  <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Subcategory</AppText>
                  <TextInput value={subcategory} onChangeText={setSubcategory} placeholder="e.g. Slim-cut chinos" placeholderTextColor={theme.colors.subtleText} returnKeyType="next" style={inputStyle} />
                </View>

                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Brand</AppText>
                    <TextInput value={brand} onChangeText={setBrand} placeholder="e.g. COS" placeholderTextColor={theme.colors.subtleText} returnKeyType="next" style={inputStyle} />
                  </View>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Size</AppText>
                    <TextInput value={size} onChangeText={setSize} placeholder="e.g. M / 32" placeholderTextColor={theme.colors.subtleText} returnKeyType="next" style={inputStyle} />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Primary Color</AppText>
                    <TextInput value={primaryColor} onChangeText={setPrimaryColor} placeholder="e.g. Navy" placeholderTextColor={theme.colors.subtleText} returnKeyType="next" style={inputStyle} />
                  </View>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Material</AppText>
                    <TextInput value={material} onChangeText={setMaterial} placeholder="e.g. Wool" placeholderTextColor={theme.colors.subtleText} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} style={inputStyle} />
                  </View>
                </View>

                <PillPicker
                  label="Color Family"
                  options={CLOSET_COLOR_FAMILY_OPTIONS}
                  value={colorFamily}
                  onChange={setColorFamily}
                />

                <PillPicker
                  label="Formality"
                  options={CLOSET_FORMALITY_OPTIONS}
                  value={formality}
                  onChange={setFormality}
                />

                <PillPicker
                  label="Weight"
                  options={CLOSET_WEIGHT_OPTIONS}
                  value={weight}
                  onChange={setWeight}
                />

                <PillPicker
                  label="Pattern"
                  options={CLOSET_PATTERN_OPTIONS}
                  value={pattern}
                  onChange={setPattern}
                />

                <PillPicker
                  label="Season"
                  options={CLOSET_SEASON_OPTIONS}
                  value={season}
                  onChange={setSeason}
                />

                <SilhouettePicker value={silhouette} onChange={setSilhouette} />

                <FitStatusPicker value={fitStatus} onChange={setFitStatus} />

                <View style={{ gap: spacing.xs }}>
                  <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Notes</AppText>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Any additional details..."
                    placeholderTextColor={theme.colors.subtleText}
                    multiline
                    numberOfLines={3}
                    style={[inputStyle, { minHeight: 80, paddingTop: spacing.sm, textAlignVertical: 'top' }]}
                  />
                </View>

                {saveError ? <AppText style={{ color: theme.colors.danger, fontSize: 13 }}>{saveError}</AppText> : null}

                <PrimaryButton
                  label={isSaving ? 'Saving...' : isAnalyzing ? 'AI filling in...' : isGeneratingSketch ? 'Generating sketch...' : 'Save to Closet'}
                  onPress={() => void handleSave()}
                  disabled={isSaving || isAnalyzing || isGeneratingSketch || !title.trim()}
                />
                <PrimaryButton
                  label={isInQueue ? 'Cancel Remaining' : 'Cancel'}
                  onPress={handleClose}
                  variant="secondary"
                />
              </View>
            </ScrollView>
          </View>
        </View>
    </Modal>
  );
}
