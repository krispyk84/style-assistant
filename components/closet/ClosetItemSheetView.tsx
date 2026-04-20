import { Image } from 'expo-image';

import { AppIcon } from '@/components/ui/app-icon';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Keyboard, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, TextInput, View,
} from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing, theme as staticTheme } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useImagePicker } from '@/hooks/use-image-picker';
import { incrementClosetItemCounter } from '@/lib/closet-storage';
import { closetService } from '@/services/closet';
import { uploadsService } from '@/services/uploads';
import { ColorFamilyPicker } from './color-family-picker';
import { FitStatusPicker } from './fit-status-picker';
import { FormalityPicker } from './formality-picker';
import { PatternPicker } from './pattern-picker';
import { SeasonPicker } from './season-picker';
import { SilhouettePicker } from './silhouette-picker';
import { WeightPicker } from './weight-picker';
import type { ClosetItem } from '@/types/closet';
import { CLOSET_FIT_STATUS_OPTIONS, CLOSET_SILHOUETTE_OPTIONS } from '@/types/closet';
import { useClosetItemEditor } from './useClosetItemEditor';
import { useClosetItemSubmit } from './useClosetItemSubmit';

// ── Types ──────────────────────────────────────────────────────────────────────

export type ClosetItemSheetViewProps = {
  item: ClosetItem | null;
  onClose: () => void;
  onSaved: (item: ClosetItem) => void;
  onDeleted: (id: string) => void;
};

// ── Component ──────────────────────────────────────────────────────────────────

export function ClosetItemSheetView({ item, onClose, onSaved, onDeleted }: ClosetItemSheetViewProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const [cellWidth, setCellWidth] = useState(0);

  // Separate animation channels: backdrop fades, sheet slides
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(800)).current;

  // Animate in on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate out then call onClose so the parent unmounts us
  function dismissAndClose() {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: 800, duration: 240, useNativeDriver: true }),
    ]).start(() => onClose());
  }

  const picker = useImagePicker();
  const [isReplacingPhoto, setIsReplacingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  async function handleReplacePhoto() {
    const picked = await picker.pickFromLibrary();
    if (!picked || !item) return;
    setIsReplacingPhoto(true);
    setPhotoError(null);
    try {
      const uploadResult = await uploadsService.uploadImage({ image: picked, category: 'anchor-item' });
      if (!uploadResult.success || !uploadResult.data) {
        setPhotoError('Upload failed. Try again.');
        return;
      }
      const updateResult = await closetService.updateItem({ id: item.id, uploadedImageUrl: uploadResult.data.publicUrl });
      if (updateResult.success && updateResult.data) {
        onSaved(updateResult.data);
      } else {
        setPhotoError('Could not save photo. Try again.');
      }
    } catch {
      setPhotoError('Upload failed. Try again.');
    } finally {
      setIsReplacingPhoto(false);
    }
  }

  const editor = useClosetItemEditor({ item });
  const submit = useClosetItemSubmit({
    item,
    setError: editor.setError,
    setIsEditing: editor.setIsEditing,
    onSaved,
    onDeleted,
  });

  function handleAnchorToOutfit() {
    if (!item) return;
    const id = item.id;
    const anchorImageUrl = item.sketchImageUrl ?? item.uploadedImageUrl ?? '';
    void incrementClosetItemCounter(id, 'anchorToOutfitCount');
    void closetService.recordAnchorUsed(id);
    onClose();
    // Defer navigation until after the modal close state update has flushed
    setTimeout(() => {
      router.push({
        pathname: '/create-look',
        params: {
          closetItemId: id,
          closetItemTitle: item.title,
          closetItemImageUrl: anchorImageUrl,
          closetItemFitStatus: item.fitStatus,
        },
      });
    }, 50);
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

  // Images available for the carousel — sketch first, then original photo.
  const images: string[] = [
    item?.sketchImageUrl ?? null,
    item?.uploadedImageUrl ?? null,
  ].filter((u): u is string => Boolean(u));
  const [activeIndex, setActiveIndex] = useState(0);

  // Reset carousel position when item changes
  useEffect(() => { setActiveIndex(0); }, [item?.id]);

  return (
    <Modal animationType="none" transparent visible onRequestClose={dismissAndClose}>
      {/* Backdrop: absolute fill, only opacity animates — never slides */}
      <Animated.View
        pointerEvents="none"
        style={{
          backgroundColor: 'rgba(24, 18, 14, 0.52)',
          bottom: 0,
          left: 0,
          opacity: backdropOpacity,
          position: 'absolute',
          right: 0,
          top: 0,
        }}
      />
      {/* Sheet: only translateY animates */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            maxHeight: '96%',
            overflow: 'hidden',
            transform: [{ translateY: sheetTranslateY }],
          }}>
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xl }}>

            {/* Header */}
            <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
                {editor.isEditing ? 'Edit Item' : 'View Item'}
              </AppText>
              <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
                {!editor.isEditing ? (
                  <>
                    <Pressable hitSlop={8} onPress={() => editor.setIsEditing(true)}>
                      <AppIcon color={theme.colors.mutedText} name="pencil" size={20} />
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => editor.setConfirmDelete(true)}>
                      <AppIcon color="#D26A5C" name="trash" size={20} />
                    </Pressable>
                  </>
                ) : null}
                {editor.isEditing ? (
                  <Pressable hitSlop={8} onPress={() => { editor.setIsEditing(false); editor.setError(null); }}>
                    <AppText style={{ color: theme.colors.mutedText, fontSize: 15, fontFamily: theme.fonts.sans }}>Cancel</AppText>
                  </Pressable>
                ) : (
                  <Pressable hitSlop={8} onPress={dismissAndClose}>
                    <AppIcon color={theme.colors.mutedText} name="close" size={22} />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Item image */}
            <View
              onLayout={(e) => setCellWidth(e.nativeEvent.layout.width)}
              style={{
                aspectRatio: 3 / 4,
                backgroundColor: theme.colors.card,
                borderRadius: 20,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              {images.length > 0 && cellWidth > 0 ? (
                <>
                  <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    scrollEventThrottle={16}
                    onScroll={(e) => {
                      const index = Math.round(e.nativeEvent.contentOffset.x / cellWidth);
                      setActiveIndex(index);
                    }}
                    style={{ width: cellWidth, flex: 1 }}>
                    {images.map((uri, i) => (
                      <Image key={i} contentFit="contain" source={{ uri }} style={{ width: cellWidth, height: '100%' }} />
                    ))}
                  </ScrollView>
                  {images.length > 1 ? (
                    <View style={{ bottom: 10, flexDirection: 'row', gap: 5, position: 'absolute', alignSelf: 'center' }}>
                      {images.map((_, i) => (
                        <View
                          key={i}
                          style={{
                            backgroundColor: theme.colors.accent,
                            borderRadius: 999,
                            height: 6,
                            width: 6,
                            opacity: i === activeIndex ? 0.9 : 0.35,
                          }}
                        />
                      ))}
                    </View>
                  ) : null}
                </>
              ) : images.length > 0 ? (
                // cellWidth not yet measured — show first image statically to avoid flicker
                <Image contentFit="contain" source={{ uri: images[0]! }} style={{ height: '100%', width: '100%' }} />
              ) : item?.sketchStatus === 'pending' ? (
                <View style={{ alignItems: 'center', gap: spacing.sm }}>
                  <AppIcon color={theme.colors.subtleText} name="clock" size={32} />
                  <AppText tone="muted" style={{ fontSize: 12, textAlign: 'center' }}>Sketch generating...</AppText>
                </View>
              ) : (
                <Pressable onPress={() => void handleReplacePhoto()} style={{ alignItems: 'center', gap: spacing.sm }}>
                  <AppIcon color={theme.colors.subtleText} name={isReplacingPhoto ? 'upload' : 'camera'} size={32} />
                  <AppText tone="muted" style={{ fontSize: 12 }}>
                    {isReplacingPhoto ? 'Uploading...' : 'Tap to add photo'}
                  </AppText>
                </Pressable>
              )}
            </View>

            {/* Anchor to Outfit button */}
            {!editor.isEditing && !editor.confirmDelete ? (
              <Pressable
                onPress={handleAnchorToOutfit}
                style={{
                  alignItems: 'center',
                  backgroundColor: theme.colors.accent,
                  borderRadius: 999,
                  flexDirection: 'row',
                  gap: spacing.sm,
                  justifyContent: 'center',
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                }}>
                <AppIcon color="#FFF" name="shirt" size={16} />
                <AppText variant="eyebrow" style={{ color: '#FFF', letterSpacing: 1.4 }}>
                  Anchor to Outfit
                </AppText>
              </Pressable>
            ) : null}

            {/* Delete confirmation */}
            {editor.confirmDelete ? (
              <View style={{ gap: spacing.md }}>
                <View
                  style={{
                    backgroundColor: theme.colors.dangerSurface,
                    borderColor: theme.colors.danger,
                    borderRadius: 16,
                    borderWidth: 1,
                    gap: spacing.xs,
                    padding: spacing.md,
                  }}>
                  <AppText variant="sectionTitle" style={{ color: theme.colors.danger }}>Remove from closet?</AppText>
                  <AppText tone="muted" style={{ fontSize: 13 }}>
                    This will permanently delete "{item?.title}" from your wardrobe.
                  </AppText>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <PrimaryButton label="Cancel" onPress={() => editor.setConfirmDelete(false)} variant="secondary" style={{ flex: 1 }} />
                  <PrimaryButton
                    label={submit.isDeleting ? 'Removing...' : 'Remove'}
                    onPress={() => void submit.handleDelete()}
                    disabled={submit.isDeleting}
                    style={{ flex: 1, backgroundColor: '#C95F4A' }}
                  />
                </View>
              </View>

            ) : editor.isEditing ? (
              /* Edit mode — full metadata form */
              <View style={{ gap: spacing.md }}>

                {/* Replace photo */}
                <Pressable
                  onPress={() => void handleReplacePhoto()}
                  disabled={isReplacingPhoto}
                  style={{
                    alignItems: 'center',
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                    borderRadius: 14,
                    borderWidth: 1,
                    flexDirection: 'row',
                    gap: spacing.sm,
                    justifyContent: 'center',
                    opacity: isReplacingPhoto ? 0.5 : 1,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm + 2,
                  }}>
                  <AppIcon color={theme.colors.mutedText} name="camera" size={16} />
                  <AppText style={{ color: theme.colors.mutedText, fontSize: 14, fontFamily: staticTheme.fonts.sansMedium }}>
                    {isReplacingPhoto ? 'Uploading photo...' : item?.uploadedImageUrl ? 'Replace photo' : 'Add photo'}
                  </AppText>
                </Pressable>
                {photoError ? (
                  <AppText style={{ color: theme.colors.danger, fontSize: 12, textAlign: 'center', marginTop: -spacing.xs }}>
                    {photoError}
                  </AppText>
                ) : null}

                {/* AI Auto-Fill */}
                <Pressable
                  onPress={() => void editor.handleAIAutofill()}
                  disabled={editor.isAnalyzing || !(item?.uploadedImageUrl || item?.sketchImageUrl)}
                  style={{
                    alignItems: 'center',
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.accent,
                    borderRadius: 14,
                    borderWidth: 1,
                    flexDirection: 'row',
                    gap: spacing.sm,
                    justifyContent: 'center',
                    opacity: editor.isAnalyzing || !(item?.uploadedImageUrl || item?.sketchImageUrl) ? 0.45 : 1,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm + 2,
                  }}>
                  <AppIcon color={theme.colors.accent} name="magic-wand" size={16} />
                  <AppText style={{ color: theme.colors.accent, fontSize: 14, fontFamily: staticTheme.fonts.sansMedium }}>
                    {editor.isAnalyzing ? 'Analyzing image...' : 'AI Auto-Fill Metadata'}
                  </AppText>
                </Pressable>
                {!(item?.uploadedImageUrl || item?.sketchImageUrl) ? (
                  <AppText tone="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: -spacing.xs }}>
                    Add a photo to enable AI auto-fill
                  </AppText>
                ) : (
                  <AppText tone="muted" style={{ fontSize: 11, textAlign: 'center', marginTop: -spacing.xs }}>
                    Fills empty fields only — your existing data is preserved
                  </AppText>
                )}

                {/* ── Basics ── */}
                <EditSectionLabel label="BASICS" />
                <FieldInput label="Title" value={editor.title} onChangeText={editor.setTitle} returnKeyType="next" />
                <FieldInput label="Category" value={editor.category} onChangeText={editor.setCategory} returnKeyType="next" />
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <FieldInput label="Brand" value={editor.brand} onChangeText={editor.setBrand} returnKeyType="next" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FieldInput label="Size" value={editor.size} onChangeText={editor.setSize} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
                  </View>
                </View>

                {/* ── Color & Material ── */}
                <EditSectionLabel label="COLOR & MATERIAL" />
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <FieldInput label="Primary Color" value={editor.primaryColor} onChangeText={editor.setPrimaryColor} placeholder="e.g. Navy" returnKeyType="next" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FieldInput label="Material" value={editor.material} onChangeText={editor.setMaterial} placeholder="e.g. Wool" returnKeyType="next" />
                  </View>
                </View>
                <ColorFamilyPicker value={editor.colorFamily} onChange={editor.setColorFamily} />
                <PatternPicker value={editor.pattern} onChange={editor.setPattern} />
                <WeightPicker value={editor.weight} onChange={editor.setWeight} />

                {/* ── Shape & Style ── */}
                <EditSectionLabel label="SHAPE & STYLE" />
                <FieldInput
                  label="Subcategory"
                  value={editor.subcategory}
                  onChangeText={editor.setSubcategory}
                  placeholder="e.g. Slim Chino, Chelsea Boot"
                  returnKeyType="next"
                />
                <SilhouettePicker value={editor.silhouette} onChange={editor.setSilhouette} />
                <FormalityPicker value={editor.formality} onChange={editor.setFormality} />
                <SeasonPicker value={editor.season} onChange={editor.setSeason} />

                {/* ── Personal Fit ── */}
                <EditSectionLabel label="PERSONAL FIT" />
                <FitStatusPicker value={editor.fitStatus} onChange={editor.setFitStatus} />

                {/* ── Notes ── */}
                <EditSectionLabel label="NOTES" />
                <TextInput
                  value={editor.notes}
                  onChangeText={editor.setNotes}
                  multiline
                  numberOfLines={3}
                  placeholder="Any personal notes about this item..."
                  placeholderTextColor={theme.colors.mutedText}
                  style={[inputStyle, { height: 80, textAlignVertical: 'top', paddingTop: spacing.sm }]}
                />

                {editor.error ? <AppText style={{ color: theme.colors.danger, fontSize: 13 }}>{editor.error}</AppText> : null}
                <PrimaryButton
                  label={submit.isSaving ? 'Saving...' : 'Save Changes'}
                  onPress={() => void submit.handleSave(editor.getFields())}
                  disabled={submit.isSaving || !editor.title.trim()}
                />
              </View>

            ) : (
              /* View mode — structured metadata display */
              <View style={{ gap: spacing.md }}>
                <LabelRow label="Title" value={item?.title} />
                <LabelRow label="Category" value={item?.subcategory ? `${item.category} · ${item.subcategory}` : item?.category} />
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}><LabelRow label="Brand" value={item?.brand || '—'} /></View>
                  <View style={{ flex: 1 }}><LabelRow label="Size" value={item?.size || '—'} /></View>
                </View>
                {/* Color & Material */}
                <MetadataRow fields={[
                  { label: 'Color', value: item?.primaryColor },
                  { label: 'Color Family', value: item?.colorFamily ? cap(item.colorFamily) : undefined },
                  { label: 'Material', value: item?.material },
                ]} />
                <MetadataRow fields={[
                  { label: 'Pattern', value: item?.pattern },
                  { label: 'Weight', value: item?.weight },
                  { label: 'Formality', value: item?.formality },
                ]} />
                {/* Shape, season & fit */}
                <MetadataRow fields={[
                  { label: 'Silhouette', value: CLOSET_SILHOUETTE_OPTIONS.find((o) => o.value === item?.silhouette)?.label },
                  { label: 'Season', value: item?.season ? cap(item.season) : undefined },
                  { label: 'Personal Fit', value: CLOSET_FIT_STATUS_OPTIONS.find((o) => o.value === item?.fitStatus)?.label },
                ]} />
                {item?.notes ? <LabelRow label="Notes" value={item.notes} /> : null}

                {/* Usage counters */}
                {(item?.anchorCount !== undefined || item?.matchCount !== undefined) ? (
                  <View style={{ borderTopColor: theme.colors.border, borderTopWidth: 1, paddingTop: spacing.md, flexDirection: 'row', gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <LabelRow label="Anchored" value={String(item?.anchorCount ?? 0)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <LabelRow label="Matched" value={String(item?.matchCount ?? 0)} />
                    </View>
                  </View>
                ) : null}
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Private helpers ────────────────────────────────────────────────────────────

function LabelRow({ label, value }: { label: string; value?: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>{label}</AppText>
      <AppText style={{ fontSize: 15, color: theme.colors.text, fontFamily: theme.fonts.sans }}>{value ?? '—'}</AppText>
    </View>
  );
}

/** Renders a horizontal row of up to 3 populated label/value pairs. Skips empty fields gracefully. */
function MetadataRow({ fields }: { fields: { label: string; value?: string | null }[] }) {
  const populated = fields.filter((f) => f.value);
  if (!populated.length) return null;
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {populated.map((f) => (
        <View key={f.label} style={{ flex: 1 }}>
          <LabelRow label={f.label} value={f.value ?? undefined} />
        </View>
      ))}
    </View>
  );
}

/** Thin hairline section divider with an eyebrow label for the edit form. */
function EditSectionLabel({ label }: { label: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ borderTopColor: theme.colors.border, borderTopWidth: 1, paddingTop: spacing.sm, marginTop: spacing.xs }}>
      <AppText style={{ color: theme.colors.mutedText, fontFamily: staticTheme.fonts.sansMedium, fontSize: 9, letterSpacing: 2 }}>
        {label}
      </AppText>
    </View>
  );
}

/** Label + TextInput combo — eliminates the repetitive eyebrow/input pattern in the edit form. */
function FieldInput({ label, style, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  const { theme } = useTheme();
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
    <View style={{ gap: spacing.xs }}>
      <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>{label}</AppText>
      <TextInput style={[inputStyle, style]} placeholderTextColor={theme.colors.mutedText} {...props} />
    </View>
  );
}

/** Capitalizes the first letter of a string (for displaying enum-like values). */
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
