import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRef } from 'react';
import { Animated, Keyboard, PanResponder, Pressable, ScrollView, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { FitStatusPicker } from '@/components/closet/fit-status-picker';
import { LoadingState } from '@/components/ui/loading-state';
import { PillPicker } from '@/components/closet/pill-picker';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SilhouettePicker } from '@/components/closet/silhouette-picker';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import {
  CLOSET_COLOR_FAMILY_OPTIONS,
  CLOSET_FORMALITY_OPTIONS,
  CLOSET_FRAME_COLOR_OPTIONS,
  CLOSET_LENS_SHAPE_OPTIONS,
  CLOSET_PATTERN_OPTIONS,
  CLOSET_SEASON_OPTIONS,
  CLOSET_WEIGHT_OPTIONS,
  type ClosetItemColorFamily,
  type ClosetItemFitStatus,
  type ClosetItemFrameColor,
  type ClosetItemLensShape,
  type ClosetItemSilhouette,
} from '@/types/closet';
import type { UploadedImageAsset } from '@/types/media';
import type { ClosetFormFields } from './closet-form-mappers';

// ── Props ─────────────────────────────────────────────────────────────────────

export type SaveToClosetFormProps = {
  // Image area
  displayImageUri: string | null;
  cellWidth: number;
  onImageLayout: (width: number) => void;
  hasBothImages: boolean;
  sketchImageUrl: string | null;
  isUploadingImage: boolean;
  isPicking: boolean;
  isPickingLibrary: boolean;
  isPickingCamera: boolean;
  /** When set, the picker buttons and trash are suppressed (pre-supplied image). */
  uploadedImageProp: UploadedImageAsset | null | undefined;
  loadingContext: boolean | undefined;

  // Queue
  isInQueue: boolean;
  currentQueueIndex: number;
  queueTotal: number;

  // Async / error states
  isAnalyzing: boolean;
  isSaving: boolean;
  isGeneratingSketch: boolean;
  sketchTranslateX: Animated.Value;
  sketchError: string | null;
  saveError: string | null;

  // Form fields
  fields: ClosetFormFields;
  setTitle: (v: string) => void;
  setBrand: (v: string) => void;
  setSize: (v: string) => void;
  setCategory: (v: string) => void;
  setSubcategory: (v: string) => void;
  setPrimaryColor: (v: string) => void;
  setMaterial: (v: string) => void;
  setNotes: (v: string) => void;
  setColorFamily: (v: ClosetItemColorFamily | undefined) => void;
  setSilhouette: (v: ClosetItemSilhouette | undefined) => void;
  setFitStatus: (v: ClosetItemFitStatus | undefined) => void;
  setFormality: (v: string | undefined) => void;
  setWeight: (v: string | undefined) => void;
  setPattern: (v: string | undefined) => void;
  setSeason: (v: string | undefined) => void;
  setLensShape: (v: ClosetItemLensShape | undefined) => void;
  setFrameColor: (v: ClosetItemFrameColor | undefined) => void;

  // Handlers
  onPickFromLibrary: () => void;
  onCapturePhoto: () => void;
  onReset: () => void;
  onAIAutofill: () => void;
  onGenerateSketch: () => void;
  onSave: () => void;
  onClose: () => void;
};

// ── View ──────────────────────────────────────────────────────────────────────

export function SaveToClosetForm({
  displayImageUri,
  cellWidth,
  onImageLayout,
  hasBothImages,
  sketchImageUrl,
  isUploadingImage,
  isPicking,
  isPickingLibrary,
  isPickingCamera,
  uploadedImageProp,
  loadingContext,
  isInQueue,
  currentQueueIndex,
  queueTotal,
  isAnalyzing,
  isSaving,
  isGeneratingSketch,
  sketchTranslateX,
  sketchError,
  saveError,
  fields,
  setTitle,
  setBrand,
  setSize,
  setCategory,
  setSubcategory,
  setPrimaryColor,
  setMaterial,
  setNotes,
  setColorFamily,
  setSilhouette,
  setFitStatus,
  setFormality,
  setWeight,
  setPattern,
  setSeason,
  setLensShape,
  setFrameColor,
  onPickFromLibrary,
  onCapturePhoto,
  onReset,
  onAIAutofill,
  onGenerateSketch,
  onSave,
  onClose,
}: SaveToClosetFormProps) {
  const { theme } = useTheme();

  // Two-image carousel — PanResponder instead of nested horizontal ScrollView.
  // A nested horizontal ScrollView inside a vertical ScrollView causes gesture
  // responder conflicts on iOS: the outer vertical ScrollView claims the touch
  // before the inner horizontal one can respond, requiring multiple swipe attempts.
  // PanResponder claims the gesture only when dx clearly exceeds dy, letting
  // the outer vertical ScrollView handle everything else normally.
  const carouselSlide = useRef(new Animated.Value(0)).current;
  const carouselIndex = useRef(0);
  const carouselPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8,
      onPanResponderMove: (_, { dx }) => {
        const base = carouselIndex.current === 0 ? 0 : -cellWidth;
        carouselSlide.setValue(base + dx);
      },
      onPanResponderRelease: (_, { dx, vx }) => {
        const threshold = cellWidth * 0.3;
        const goNext = carouselIndex.current === 0 && (dx < -threshold || vx < -0.5);
        const goPrev = carouselIndex.current === 1 && (dx > threshold || vx > 0.5);
        if (goNext) {
          carouselIndex.current = 1;
          Animated.spring(carouselSlide, { toValue: -cellWidth, useNativeDriver: true, overshootClamping: true }).start();
        } else if (goPrev) {
          carouselIndex.current = 0;
          Animated.spring(carouselSlide, { toValue: 0, useNativeDriver: true, overshootClamping: true }).start();
        } else {
          Animated.spring(carouselSlide, { toValue: carouselIndex.current === 0 ? 0 : -cellWidth, useNativeDriver: true, overshootClamping: true }).start();
        }
      },
    })
  ).current;

  // Reset carousel to first slide whenever a new sketch appears
  const prevSketchUrl = useRef<string | null>(null);
  if (sketchImageUrl !== prevSketchUrl.current) {
    prevSketchUrl.current = sketchImageUrl;
    carouselIndex.current = 0;
    carouselSlide.setValue(0);
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

  return (
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
        <Pressable hitSlop={8} onPress={onClose}>
          <Ionicons color={theme.colors.mutedText} name="close" size={22} />
        </Pressable>
      </View>

      {/* Background-generation context banner */}
      {loadingContext ? (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.subtleSurface,
            borderColor: theme.colors.border,
            borderRadius: 14,
            borderWidth: 1,
            flexDirection: 'row',
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          }}>
          <Ionicons color={theme.colors.accent} name="sync-outline" size={14} />
          <AppText tone="muted" style={{ flex: 1, fontSize: 13 }}>
            Your outfit recommendations are generating in the background — save your anchor piece while you wait.
          </AppText>
        </View>
      ) : null}

      {/* Image area */}
      {displayImageUri ? (
        <View style={{ gap: spacing.sm }}>
          <View style={{ position: 'relative' }}>
            <View
              onLayout={(e) => onImageLayout(e.nativeEvent.layout.width)}
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
                  <View style={{ width: cellWidth, flex: 1, overflow: 'hidden' }} {...carouselPan.panHandlers}>
                    <Animated.View style={{ flexDirection: 'row', width: cellWidth * 2, transform: [{ translateX: carouselSlide }] }}>
                      <Image contentFit="cover" source={{ uri: sketchImageUrl! }} style={{ width: cellWidth, flex: 1 }} />
                      <Image contentFit="cover" source={{ uri: displayImageUri }} style={{ width: cellWidth, flex: 1 }} />
                    </Animated.View>
                  </View>
                  <View style={{ bottom: 8, flexDirection: 'row', gap: 5, position: 'absolute', alignSelf: 'center' }}>
                    <View style={{ backgroundColor: '#FFF', borderRadius: 999, height: 6, width: 6, opacity: 0.9 }} />
                    <View style={{ backgroundColor: '#FFF', borderRadius: 999, height: 6, width: 6, opacity: 0.45 }} />
                  </View>
                </>
              ) : (
                <Image contentFit="cover" source={{ uri: displayImageUri }} style={{ height: '100%', width: '100%' }} />
              )}
            </View>
            {!uploadedImageProp ? (
              <Pressable
                hitSlop={8}
                onPress={onReset}
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
              onPress={onGenerateSketch}
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

          {/* AI Autofill */}
          {isAnalyzing ? (
            <LoadingState
              label="Identifying piece..."
              messages={['Identifying your piece.', 'Checking the fabric situation.', 'Cataloguing with intention.']}
            />
          ) : (
            <Pressable
              onPress={onAIAutofill}
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
      ) : !uploadedImageProp ? (
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
                onPress={onPickFromLibrary}
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
                onPress={onCapturePhoto}
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
          <TextInput value={fields.title} onChangeText={setTitle} placeholder="e.g. Navy Slim Trousers" placeholderTextColor={theme.colors.subtleText} returnKeyType="next" style={inputStyle} />
        </View>

        <View style={{ gap: spacing.xs }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Category</AppText>
          <TextInput value={fields.category} onChangeText={setCategory} placeholder="e.g. Trousers" placeholderTextColor={theme.colors.subtleText} returnKeyType="next" style={inputStyle} />
        </View>

        <View style={{ gap: spacing.xs }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Subcategory</AppText>
          <TextInput value={fields.subcategory} onChangeText={setSubcategory} placeholder="e.g. Slim-cut chinos" placeholderTextColor={theme.colors.subtleText} returnKeyType="next" style={inputStyle} />
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Brand</AppText>
            <TextInput value={fields.brand} onChangeText={setBrand} placeholder="e.g. COS" placeholderTextColor={theme.colors.subtleText} returnKeyType="next" style={inputStyle} />
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Size</AppText>
            <TextInput value={fields.size} onChangeText={setSize} placeholder="e.g. M / 32" placeholderTextColor={theme.colors.subtleText} returnKeyType="next" style={inputStyle} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Primary Color</AppText>
            <TextInput value={fields.primaryColor} onChangeText={setPrimaryColor} placeholder="e.g. Navy" placeholderTextColor={theme.colors.subtleText} returnKeyType="next" style={inputStyle} />
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Material</AppText>
            <TextInput value={fields.material} onChangeText={setMaterial} placeholder="e.g. Wool" placeholderTextColor={theme.colors.subtleText} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} style={inputStyle} />
          </View>
        </View>

        <PillPicker label="Color Family" options={CLOSET_COLOR_FAMILY_OPTIONS} value={fields.colorFamily} onChange={setColorFamily} />
        <PillPicker label="Formality" options={CLOSET_FORMALITY_OPTIONS} value={fields.formality} onChange={setFormality} />
        <PillPicker label="Weight" options={CLOSET_WEIGHT_OPTIONS} value={fields.weight} onChange={setWeight} />
        <PillPicker label="Pattern" options={CLOSET_PATTERN_OPTIONS} value={fields.pattern} onChange={setPattern} />
        <PillPicker label="Season" options={CLOSET_SEASON_OPTIONS} value={fields.season} onChange={setSeason} />

        {fields.category.toLowerCase().includes('sunglass') ? (
          <>
            <PillPicker label="Lens Shape" options={CLOSET_LENS_SHAPE_OPTIONS} value={fields.lensShape} onChange={setLensShape} />
            <PillPicker label="Frame Color" options={CLOSET_FRAME_COLOR_OPTIONS} value={fields.frameColor} onChange={setFrameColor} />
          </>
        ) : null}

        <SilhouettePicker value={fields.silhouette} onChange={setSilhouette} />
        <FitStatusPicker value={fields.fitStatus} onChange={setFitStatus} />

        <View style={{ gap: spacing.xs }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Notes</AppText>
          <TextInput
            value={fields.notes}
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
          onPress={onSave}
          disabled={isSaving || isAnalyzing || isGeneratingSketch || !fields.title.trim()}
        />
        <PrimaryButton
          label={isInQueue ? 'Cancel Remaining' : 'Cancel'}
          onPress={onClose}
          variant="secondary"
        />
      </View>
    </ScrollView>
  );
}
