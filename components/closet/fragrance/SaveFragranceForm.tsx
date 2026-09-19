import { useState } from 'react';
import { Image } from 'expo-image';
import { Animated, Keyboard, Pressable, ScrollView, TextInput, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { LoadingState } from '@/components/ui/loading-state';
import { PillPicker } from '@/components/closet/pill-picker';
import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import {
  FRAGRANCE_CONCENTRATION_OPTIONS,
  FRAGRANCE_DAY_NIGHT_OPTIONS,
  FRAGRANCE_FORMALITY_OPTIONS,
  FRAGRANCE_SEASON_OPTIONS,
  FRAGRANCE_VIBE_OPTIONS,
} from '@/types/fragrance';
import type { FragranceFormFields } from '@/lib/fragrance-form-mappers';
import { AccordTagInput } from './accord-tag-input';
import { MultiPillPicker } from './multi-pill-picker';

export type SaveFragranceFormProps = {
  // Image area
  displayImageUri: string | null;
  isUploadingImage: boolean;
  uploadProgress: number;
  uploadError: string | null;
  isOriginalPhotoPending: boolean;
  onRetryUpload: () => void;
  isPicking: boolean;
  isPickingLibrary: boolean;
  isPickingCamera: boolean;
  onPickFromLibrary: () => void;
  onCapturePhoto: () => void;
  onReset: () => void;

  // Identify (unified) action
  isIdentifying: boolean;
  identifyError: string | null;
  needsReview: boolean;
  onIdentify: () => void;

  // Bottle sketch
  isGeneratingSketch: boolean;
  sketchImageUrl: string | null;
  sketchTranslateX: Animated.Value;
  sketchError: string | null;

  // Form fields
  fields: FragranceFormFields;
  setBrand: (v: string) => void;
  setName: (v: string) => void;
  setConcentration: (v: string | undefined) => void;
  setAccordNames: (v: string[]) => void;
  setPrimaryVibe: (v: string | undefined) => void;
  setSecondaryVibes: (v: string[]) => void;
  setSeasons: (v: string[]) => void;
  setDayNight: (v: string[]) => void;
  setFormalityTags: (v: string[]) => void;
  setIsSignature: (v: boolean) => void;
  setCurrentVolumeMl: (v: string) => void;
  setUserNotes: (v: string) => void;

  // Save
  isSaving: boolean;
  saveError: string | null;
  onSave: () => void;
  onClose: () => void;

  // Correction affordance — "actually, this is a garment"
  onSwitchToGarment: () => void;
};

export function SaveFragranceForm({
  displayImageUri,
  isUploadingImage,
  uploadProgress,
  uploadError,
  isOriginalPhotoPending,
  onRetryUpload,
  isPicking,
  isPickingLibrary,
  isPickingCamera,
  onPickFromLibrary,
  onCapturePhoto,
  onReset,
  isIdentifying,
  identifyError,
  needsReview,
  onIdentify,
  isGeneratingSketch,
  sketchImageUrl,
  sketchTranslateX,
  sketchError,
  fields,
  setBrand,
  setName,
  setConcentration,
  setAccordNames,
  setPrimaryVibe,
  setSecondaryVibes,
  setSeasons,
  setDayNight,
  setFormalityTags,
  setIsSignature,
  setCurrentVolumeMl,
  setUserNotes,
  isSaving,
  saveError,
  onSave,
  onClose,
  onSwitchToGarment,
}: SaveFragranceFormProps) {
  const { theme } = useTheme();
  const [showingOriginal, setShowingOriginal] = useState(false);

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

  const heroImageUri = showingOriginal ? displayImageUri : (sketchImageUrl ?? displayImageUri);
  const noteSummary = [
    fields.topNotes?.length ? `Top: ${fields.topNotes.join(', ')}` : null,
    fields.middleNotes?.length ? `Middle: ${fields.middleNotes.join(', ')}` : null,
    fields.baseNotes?.length ? `Base: ${fields.baseNotes.join(', ')}` : null,
  ].filter(Boolean);

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
          <AppIcon color={theme.colors.accent} name="tag" size={18} />
          <AppText variant="eyebrow" style={{ letterSpacing: 1.8, color: theme.colors.mutedText }}>
            Add Fragrance
          </AppText>
        </View>
        <Pressable hitSlop={8} onPress={onClose}>
          <AppIcon color={theme.colors.mutedText} name="close" size={22} />
        </Pressable>
      </View>

      {/* Correction affordance — always visible, never forces a restart */}
      <Pressable onPress={onSwitchToGarment} hitSlop={6}>
        <AppText tone="muted" style={{ fontSize: 12, textDecorationLine: 'underline' }}>
          Not a fragrance? Switch to garment
        </AppText>
      </Pressable>

      {/* Image area */}
      {displayImageUri ? (
        <View style={{ gap: spacing.sm }}>
          <View style={{ position: 'relative' }}>
            <View
              style={{
                aspectRatio: 3 / 4,
                backgroundColor: theme.colors.card,
                borderRadius: 18,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              {heroImageUri ? (
                <Image contentFit="cover" source={{ uri: heroImageUri }} style={{ height: '100%', width: '100%' }} />
              ) : null}
            </View>
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
              <AppIcon color="#FFF" name="trash" size={15} />
            </Pressable>

            {isUploadingImage ? (
              <View
                pointerEvents="none"
                style={{
                  alignItems: 'center',
                  backgroundColor: 'rgba(0,0,0,0.45)',
                  bottom: 0, left: 0, right: 0, top: 0,
                  borderRadius: 18,
                  gap: spacing.xs,
                  justifyContent: 'center',
                  position: 'absolute',
                }}>
                <AppText style={{ color: '#FFF', fontFamily: theme.fonts.sansMedium, fontSize: 13 }}>
                  Uploading… {Math.round(uploadProgress * 100)}%
                </AppText>
              </View>
            ) : uploadError && isOriginalPhotoPending ? (
              <Pressable
                onPress={onRetryUpload}
                style={{
                  alignItems: 'center',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  bottom: 0, left: 0, right: 0, top: 0,
                  borderRadius: 18,
                  gap: spacing.xs,
                  justifyContent: 'center',
                  position: 'absolute',
                }}>
                <AppIcon color="#FFF" name="refresh" size={20} />
                <AppText style={{ color: '#FFF', fontFamily: theme.fonts.sansMedium, fontSize: 13 }}>
                  Upload failed — tap to retry
                </AppText>
              </Pressable>
            ) : null}
          </View>

          {sketchImageUrl && displayImageUri ? (
            <Pressable onPress={() => setShowingOriginal((s) => !s)} style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
              <AppIcon color={theme.colors.accent} name="swap" size={14} />
              <AppText tone="muted" style={{ fontSize: 12 }}>
                {showingOriginal ? 'Showing original photo — tap to see sketch' : 'Showing bottle sketch — tap to see original photo'}
              </AppText>
            </Pressable>
          ) : null}

          {/* Unified identify action */}
          {isGeneratingSketch || isIdentifying ? (
            <LoadingState
              label={isIdentifying ? 'Identifying fragrance...' : 'Sketching the bottle...'}
              messages={['Reading the label.', 'Matching notes and accords.', 'Sketching the bottle.']}
            />
          ) : (
            <Pressable
              onPress={onIdentify}
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
              <AppIcon color={theme.colors.accent} name="sparkles" size={16} />
              <AppText variant="eyebrow" style={{ color: theme.colors.accent, letterSpacing: 1.4 }}>
                Identify, Sketch &amp; Fill Details
              </AppText>
            </Pressable>
          )}

          {identifyError ? <AppText style={{ color: theme.colors.danger, fontSize: 12 }}>{identifyError}</AppText> : null}
          {sketchError ? <AppText style={{ color: theme.colors.danger, fontSize: 12 }}>{sketchError}</AppText> : null}
          {needsReview && !identifyError ? (
            <AppText tone="muted" style={{ fontSize: 12 }}>
              We couldn&apos;t confidently identify this fragrance — review and complete the details below.
            </AppText>
          ) : null}
        </View>
      ) : (
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
                <AppIcon color={theme.colors.text} name="image" size={16} />
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
                <AppIcon color={theme.colors.text} name="camera" size={16} />
                <AppText>{isPickingCamera ? 'Opening...' : 'Camera'}</AppText>
              </Pressable>
            </View>
          )}
          <AppText tone="muted" style={{ fontSize: 12 }}>
            Or skip the photo and enter the details manually below.
          </AppText>
        </View>
      )}

      {/* Form fields */}
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Brand</AppText>
            <TextInput value={fields.brand} onChangeText={setBrand} placeholder="e.g. Le Labo" placeholderTextColor={theme.colors.subtleText} returnKeyType="next" style={inputStyle} />
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Name</AppText>
            <TextInput value={fields.name} onChangeText={setName} placeholder="e.g. Santal 33" placeholderTextColor={theme.colors.subtleText} returnKeyType="next" style={inputStyle} />
          </View>
        </View>

        <PillPicker label="Concentration" options={FRAGRANCE_CONCENTRATION_OPTIONS} value={fields.concentration} onChange={setConcentration} />

        <AccordTagInput value={fields.accordNames} onChange={setAccordNames} />

        {noteSummary.length > 0 ? (
          <View style={{ gap: spacing.xs }}>
            <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Notes</AppText>
            <AppText tone="muted" style={{ fontSize: 13 }}>{noteSummary.join(' · ')}</AppText>
          </View>
        ) : null}

        <PillPicker label="Primary Vibe" options={FRAGRANCE_VIBE_OPTIONS} value={fields.primaryVibe} onChange={setPrimaryVibe} />
        <MultiPillPicker label="Also Fits" options={FRAGRANCE_VIBE_OPTIONS} value={fields.secondaryVibes} onChange={setSecondaryVibes} />
        <MultiPillPicker label="Best Seasons" options={FRAGRANCE_SEASON_OPTIONS} value={fields.seasons} onChange={setSeasons} />
        <MultiPillPicker label="Best Time" options={FRAGRANCE_DAY_NIGHT_OPTIONS} value={fields.dayNight} onChange={setDayNight} />
        <MultiPillPicker label="Formality" options={FRAGRANCE_FORMALITY_OPTIONS} value={fields.formalityTags} onChange={setFormalityTags} />

        <Pressable
          onPress={() => setIsSignature(!fields.isSignature)}
          style={{
            alignItems: 'center',
            backgroundColor: fields.isSignature ? theme.colors.accent : theme.colors.surface,
            borderColor: fields.isSignature ? theme.colors.accent : theme.colors.border,
            borderRadius: 14,
            borderWidth: 1,
            flexDirection: 'row',
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          }}>
          <AppIcon color={fields.isSignature ? theme.colors.inverseText : theme.colors.mutedText} name="star" size={16} />
          <AppText style={{ color: fields.isSignature ? theme.colors.inverseText : theme.colors.text, fontSize: 14 }}>
            This is one of my signature fragrances
          </AppText>
        </Pressable>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Bottle Size Left (ml)</AppText>
            <TextInput
              value={fields.currentVolumeMl}
              onChangeText={setCurrentVolumeMl}
              placeholder="Optional"
              placeholderTextColor={theme.colors.subtleText}
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              style={inputStyle}
            />
          </View>
        </View>

        <View style={{ gap: spacing.xs }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Notes</AppText>
          <TextInput
            value={fields.userNotes}
            onChangeText={setUserNotes}
            placeholder="Any additional details..."
            placeholderTextColor={theme.colors.subtleText}
            multiline
            numberOfLines={3}
            style={[inputStyle, { minHeight: 80, paddingTop: spacing.sm, textAlignVertical: 'top' }]}
          />
        </View>

        {saveError ? <AppText style={{ color: theme.colors.danger, fontSize: 13 }}>{saveError}</AppText> : null}

        <PrimaryButton
          label={
            isSaving
              ? 'Saving...'
              : isUploadingImage
                ? `Uploading photo… ${Math.round(uploadProgress * 100)}%`
                : isOriginalPhotoPending && uploadError
                  ? 'Retry photo upload to save'
                  : 'Save to Closet'
          }
          onPress={onSave}
          disabled={isSaving || isUploadingImage || isOriginalPhotoPending || !fields.brand.trim() || !fields.name.trim()}
        />
        <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
      </View>
    </ScrollView>
  );
}
