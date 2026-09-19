import { useState } from 'react';
import { Image } from 'expo-image';
import { Keyboard, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
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
import type { UserFragrance } from '@/types/fragrance';
import { AccordTagInput } from './accord-tag-input';
import { MultiPillPicker } from './multi-pill-picker';
import { PillPicker } from '@/components/closet/pill-picker';
import { useFragranceItemEditor } from './useFragranceItemEditor';
import { useFragranceItemSubmit } from './useFragranceItemSubmit';

export type FragranceItemSheetViewProps = {
  item: UserFragrance | null;
  onClose: () => void;
  onSaved: (item: UserFragrance) => void;
  onDeleted: (id: string) => void;
};

export function FragranceItemSheetView({ item, onClose, onSaved, onDeleted }: FragranceItemSheetViewProps) {
  if (!item) return null;
  return <FragranceItemSheetInner item={item} onClose={onClose} onSaved={onSaved} onDeleted={onDeleted} />;
}

function FragranceItemSheetInner({ item, onClose, onSaved, onDeleted }: Required<Omit<FragranceItemSheetViewProps, 'item'>> & { item: UserFragrance }) {
  const { theme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const editor = useFragranceItemEditor(item);
  const submit = useFragranceItemSubmit({
    onSaved: (updated) => { onSaved(updated); setIsEditing(false); },
    onDeleted,
  });

  const thumbnailUri = item.bottleSketchUrl ?? item.originalImageUrl;
  const vibeLabel = FRAGRANCE_VIBE_OPTIONS.find((v) => v.value === item.fragrance.primaryVibe)?.label;
  const accordNames = item.fragrance.mainAccords?.map((a) => a.name) ?? [];

  return (
    <Modal animationType="fade" transparent visible onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <View pointerEvents="none" style={{ flex: 1, backgroundColor: theme.colors.overlay }} />
      </Pressable>

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
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: 280 }}>

            <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
                <AppIcon color={theme.colors.accent} name="tag" size={18} />
                <AppText variant="eyebrow" style={{ letterSpacing: 1.8, color: theme.colors.mutedText }}>
                  {isEditing ? 'Edit Fragrance' : 'Fragrance'}
                </AppText>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                {!isEditing ? (
                  <Pressable hitSlop={8} onPress={() => setIsEditing(true)}>
                    <AppIcon color={theme.colors.mutedText} name="pencil" size={18} />
                  </Pressable>
                ) : null}
                <Pressable hitSlop={8} onPress={onClose}>
                  <AppIcon color={theme.colors.mutedText} name="close" size={22} />
                </Pressable>
              </View>
            </View>

            {thumbnailUri ? (
              <View style={{ aspectRatio: 3 / 4, backgroundColor: theme.colors.card, borderRadius: 18, overflow: 'hidden' }}>
                <Image contentFit="cover" source={{ uri: thumbnailUri }} style={{ height: '100%', width: '100%' }} />
              </View>
            ) : null}

            <View style={{ gap: 2 }}>
              <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 18 }}>{item.fragrance.brand}</AppText>
              <AppText tone="muted" style={{ fontSize: 15 }}>{item.fragrance.name}</AppText>
            </View>

            {!isEditing ? (
              <View style={{ gap: spacing.md }}>
                {item.fragrance.concentration ? (
                  <DetailRow label="Concentration" value={item.fragrance.concentration} />
                ) : null}
                {vibeLabel ? <DetailRow label="Primary Vibe" value={vibeLabel} /> : null}
                {accordNames.length > 0 ? <DetailRow label="Main Accords" value={accordNames.join(', ')} /> : null}
                {item.currentVolumeMl != null ? <DetailRow label="Bottle Size Left" value={`${item.currentVolumeMl} ml`} /> : null}
                {item.userNotes ? <DetailRow label="Notes" value={item.userNotes} /> : null}
                {item.isSignature ? (
                  <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
                    <AppIcon color={theme.colors.accent} name="star" size={14} />
                    <AppText tone="muted" style={{ fontSize: 13 }}>Signature fragrance</AppText>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={{ gap: spacing.md }}>
                <PillPicker label="Concentration" options={FRAGRANCE_CONCENTRATION_OPTIONS} value={editor.fields.concentration} onChange={editor.setters.setConcentration} />
                <AccordTagInput value={editor.fields.accordNames} onChange={editor.setters.setAccordNames} />
                <PillPicker label="Primary Vibe" options={FRAGRANCE_VIBE_OPTIONS} value={editor.fields.primaryVibe} onChange={editor.setters.setPrimaryVibe} />
                <MultiPillPicker label="Also Fits" options={FRAGRANCE_VIBE_OPTIONS} value={editor.fields.secondaryVibes} onChange={editor.setters.setSecondaryVibes} />
                <MultiPillPicker label="Best Seasons" options={FRAGRANCE_SEASON_OPTIONS} value={editor.fields.seasons} onChange={editor.setters.setSeasons} />
                <MultiPillPicker label="Best Time" options={FRAGRANCE_DAY_NIGHT_OPTIONS} value={editor.fields.dayNight} onChange={editor.setters.setDayNight} />
                <MultiPillPicker label="Formality" options={FRAGRANCE_FORMALITY_OPTIONS} value={editor.fields.formalityTags} onChange={editor.setters.setFormalityTags} />

                <Pressable
                  onPress={() => editor.setters.setIsSignature(!editor.fields.isSignature)}
                  style={{
                    alignItems: 'center',
                    backgroundColor: editor.fields.isSignature ? theme.colors.accent : theme.colors.surface,
                    borderColor: editor.fields.isSignature ? theme.colors.accent : theme.colors.border,
                    borderRadius: 14,
                    borderWidth: 1,
                    flexDirection: 'row',
                    gap: spacing.sm,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                  }}>
                  <AppIcon color={editor.fields.isSignature ? theme.colors.inverseText : theme.colors.mutedText} name="star" size={16} />
                  <AppText style={{ color: editor.fields.isSignature ? theme.colors.inverseText : theme.colors.text, fontSize: 14 }}>
                    Signature fragrance
                  </AppText>
                </Pressable>

                <View style={{ gap: spacing.xs }}>
                  <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Bottle Size Left (ml)</AppText>
                  <TextInput
                    value={editor.fields.currentVolumeMl}
                    onChangeText={editor.setters.setCurrentVolumeMl}
                    placeholder="Optional"
                    placeholderTextColor={theme.colors.subtleText}
                    keyboardType="numeric"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                    style={{
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      borderRadius: 14,
                      borderWidth: 1,
                      color: theme.colors.text,
                      fontFamily: theme.fonts.sans,
                      fontSize: 15,
                      minHeight: 48,
                      paddingHorizontal: spacing.md,
                    }}
                  />
                </View>

                <View style={{ gap: spacing.xs }}>
                  <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Notes</AppText>
                  <TextInput
                    value={editor.fields.userNotes}
                    onChangeText={editor.setters.setUserNotes}
                    placeholder="Any additional details..."
                    placeholderTextColor={theme.colors.subtleText}
                    multiline
                    numberOfLines={3}
                    style={{
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      borderRadius: 14,
                      borderWidth: 1,
                      color: theme.colors.text,
                      fontFamily: theme.fonts.sans,
                      fontSize: 15,
                      minHeight: 80,
                      paddingHorizontal: spacing.md,
                      paddingTop: spacing.sm,
                      textAlignVertical: 'top',
                    }}
                  />
                </View>

                {submit.saveError ? <AppText style={{ color: theme.colors.danger, fontSize: 13 }}>{submit.saveError}</AppText> : null}

                <PrimaryButton
                  label={submit.isSaving ? 'Saving...' : 'Save Changes'}
                  onPress={() => void submit.handleSave(item, editor.getFields())}
                  disabled={submit.isSaving}
                />
                <PrimaryButton label="Cancel" onPress={() => setIsEditing(false)} variant="secondary" />
              </View>
            )}

            {!isEditing ? (
              confirmingDelete ? (
                <View style={{ gap: spacing.sm }}>
                  {submit.deleteError ? <AppText style={{ color: theme.colors.danger, fontSize: 13 }}>{submit.deleteError}</AppText> : null}
                  <AppText tone="muted" style={{ fontSize: 13 }}>
                    Remove this fragrance from your closet? It will no longer be recommended with outfits.
                  </AppText>
                  <PrimaryButton
                    label={submit.isDeleting ? 'Removing...' : 'Remove from Closet'}
                    onPress={() => void submit.handleDelete(item)}
                    disabled={submit.isDeleting}
                    variant="secondary"
                  />
                  <PrimaryButton label="Cancel" onPress={() => setConfirmingDelete(false)} variant="secondary" />
                </View>
              ) : (
                <Pressable onPress={() => setConfirmingDelete(true)} hitSlop={6}>
                  <AppText style={{ color: theme.colors.danger, fontSize: 13, textAlign: 'center' }}>Remove from Closet</AppText>
                </Pressable>
              )
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6, fontSize: 11 }}>{label}</AppText>
      <AppText style={{ fontSize: 14 }}>{value}</AppText>
    </View>
  );
}
