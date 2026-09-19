import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { ClosetPickerModal } from '@/components/closet/closet-picker-modal';
import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing, theme } from '@/constants/theme';
import { evaluateClosetReadiness } from '@/lib/closet-readiness';
import { STYLISTS } from '@/lib/stylists';
import { AnchorItemCard } from './AnchorItemCard';
import { StylistPicker } from './StylistPicker';
import { StylistBriefInput } from './StylistBriefInput';
import { OptionalItemRow } from './look-form-primitives';
import type { useAnchorItemsForm } from './useAnchorItemsForm';
import type { useStylistOutfitForm } from './useStylistOutfitForm';

export type StylistOutfitFormViewProps = {
  anchorForm: ReturnType<typeof useAnchorItemsForm>;
  stylistForm: ReturnType<typeof useStylistOutfitForm>;
  isSubmitting: boolean;
  submitError: string | null;
  onGenerate: () => void;
};

export function StylistOutfitFormView({ anchorForm, stylistForm, isSubmitting, submitError, onGenerate }: StylistOutfitFormViewProps) {
  const {
    anchorItems,
    anchorError,
    showAddToClosetCheckbox,
    shouldAddAnchorToCloset,
    closetItems,
    closetPickerVisible,
    populatedAnchorItems,
    updateAnchorItem,
    addAnchorItem,
    removeAnchorItem,
    handlePickFromCloset,
    toggleShouldAddAnchorToCloset,
    handleClosetItemSelected,
    handleClosetPickerClose,
  } = anchorForm;
  const { stylistId, stylistBrief, closetOnly, stylistError, briefError, selectStylist, updateBrief, toggleClosetOnly } = stylistForm;

  const selectedStylist = STYLISTS.find((s) => s.id === stylistId) ?? null;
  const isClosetReady = useMemo(() => evaluateClosetReadiness(closetItems).ready, [closetItems]);
  const hasAnyInput = populatedAnchorItems.length > 0;

  return (
    <View style={{ gap: spacing.xl }}>
      {/* Starting Pieces — reuses the same anchor-item cards, hook, and 5-item
          cap as the original Build Around a Piece flow. These are the pieces
          the stylist is being asked to build around. */}
      <View style={{ gap: spacing.md }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>Starting Pieces</AppText>
          <AppText variant="eyebrow" tone="subtle">{anchorItems.length}/5 Items</AppText>
        </View>

        {anchorItems.map((item, index) => (
          <AnchorItemCard
            key={item.id}
            item={item}
            isPrimary={index === 0}
            removable={index > 0}
            onChange={updateAnchorItem}
            onRemove={() => removeAnchorItem(item.id)}
            onPickFromCloset={closetItems.length > 0 ? () => handlePickFromCloset(item.id) : undefined}
            showSaveToCloset={index === 0 && showAddToClosetCheckbox}
            saveToCloset={shouldAddAnchorToCloset}
            onToggleSaveToCloset={toggleShouldAddAnchorToCloset}
          />
        ))}

        {anchorError ? <AppText style={{ color: theme.colors.danger }}>{anchorError}</AppText> : null}

        <Pressable
          disabled={anchorItems.length >= 5}
          onPress={addAnchorItem}
          style={{
            alignItems: 'center',
            borderColor: theme.colors.border,
            borderRadius: 999,
            borderStyle: 'dashed',
            borderWidth: 1,
            flexDirection: 'row',
            gap: spacing.xs,
            justifyContent: 'center',
            opacity: anchorItems.length >= 5 ? 0.5 : 1,
            paddingVertical: spacing.md,
          }}>
          <AppIcon color={theme.colors.mutedText} name="add" size={16} />
          <AppText tone="muted">
            {anchorItems.length >= 5 ? 'Maximum of 5 items reached' : 'Add Item'}
          </AppText>
        </Pressable>
      </View>

      <ClosetPickerModal
        visible={closetPickerVisible}
        items={closetItems}
        onSelect={handleClosetItemSelected}
        onClose={handleClosetPickerClose}
      />

      {/* Choose Your Stylist */}
      <View style={{ gap: spacing.md }}>
        <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>Choose Your Stylist</AppText>
        <StylistPicker selectedId={stylistId} onSelect={selectStylist} />
        {stylistError ? <AppText style={{ color: theme.colors.danger }}>{stylistError}</AppText> : null}
      </View>

      {/* Tell Your Stylist — the single conversational brief, replacing the
          original form's Season/Style Keywords/Optional Items/Additional
          Details/Occasion Formality fields. */}
      <View style={{ gap: spacing.sm }}>
        <StylistBriefInput value={stylistBrief} onChangeText={updateBrief} stylist={selectedStylist} />
        {briefError ? <AppText style={{ color: theme.colors.danger }}>{briefError}</AppText> : null}
      </View>

      {/* Closet Only — same wording/semantics as the original flow, only
          offered once the wardrobe is generative-ready. */}
      {isClosetReady ? (
        <View style={{ gap: spacing.md }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>From Your Closet</AppText>
          <View style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: 18,
            borderWidth: 1,
            padding: spacing.md,
          }}>
            <OptionalItemRow
              label="Pair only items from my closet"
              description="Build these looks entirely from pieces you already own instead of AI-generated suggestions."
              checked={closetOnly}
              onToggle={toggleClosetOnly}
            />
          </View>
        </View>
      ) : null}

      {submitError ? <AppText style={{ color: theme.colors.danger }}>{submitError}</AppText> : null}

      <PrimaryButton
        disabled={!hasAnyInput || isSubmitting}
        label={isSubmitting ? 'Generating...' : `Generate ${selectedStylist ? `${selectedStylist.name}'s ` : ''}Looks`}
        onPress={onGenerate}
      />
    </View>
  );
}
