import { Pressable, TextInput, View } from 'react-native';

import { AppIcon, type AppIconName } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { ClosetPickerModal } from '@/components/closet/closet-picker-modal';
import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing, theme } from '@/constants/theme';
import { LOOK_TIER_OPTIONS, type LookTierSlug } from '@/types/look-request';
import type { WeatherSeason } from '@/types/weather';
import { AnchorItemCard } from './AnchorItemCard';
import { OptionalItemRow } from './look-form-primitives';
import type { useAnchorItemsForm } from './useAnchorItemsForm';
import type { useCreateLookRequestForm } from './useCreateLookRequestForm';

const VIBE_SUGGESTIONS = ['Old Money', 'Resort', 'Minimalist', 'European Summer', 'Streetwear', 'Coastal'];

const SEASON_OPTIONS: { value: WeatherSeason; label: string; icon: AppIconName }[] = [
  { value: 'spring', label: 'Spring', icon: 'sparkles' },
  { value: 'summer', label: 'Summer', icon: 'sun' },
  { value: 'fall',   label: 'Fall',   icon: 'wind' },
  { value: 'winter', label: 'Winter', icon: 'snow' },
];

const TIER_CONFIG: Record<LookTierSlug, { label: string; icon: AppIconName }> = {
  business: { label: 'Business', icon: 'briefcase' },
  'smart-casual': { label: 'Smart\nCasual', icon: 'sparkles' },
  casual: { label: 'Casual', icon: 'coffee' },
};

export type CreateLookRequestFormViewProps = {
  anchorForm: ReturnType<typeof useAnchorItemsForm>;
  lookForm: ReturnType<typeof useCreateLookRequestForm>;
  onContinue: () => void;
};

export function CreateLookRequestFormView({ anchorForm, lookForm, onContinue }: CreateLookRequestFormViewProps) {
  const {
    anchorItems,
    anchorError,
    showAddToClosetCheckbox,
    shouldAddAnchorToCloset,
    closetItems,
    closetPickerVisible,
    isUploading,
    populatedAnchorItems,
    updateAnchorItem,
    addAnchorItem,
    removeAnchorItem,
    handlePickFromCloset,
    toggleShouldAddAnchorToCloset,
    handleClosetItemSelected,
    handleClosetPickerClose,
  } = anchorForm;
  const {
    selectedSeason,
    isSeasonExpanded,
    setSelectedSeason,
    setIsSeasonExpanded,
    vibeKeywords,
    isKeywordsExpanded,
    setVibeKeywords,
    setIsKeywordsExpanded,
    toggleVibeKeyword,
    selectedTiers,
    tierError,
    toggleTier,
    includeBag,
    includeHat,
    toggleIncludeBag,
    toggleIncludeHat,
  } = lookForm;
  const hasAnyInput = populatedAnchorItems.length > 0;

  return (
    <View style={{ gap: spacing.xl }}>

      {/* Wardrobe Anchors */}
      <View style={{ gap: spacing.md }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>Wardrobe Anchors</AppText>
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

        {anchorError ? (
          <AppText style={{ color: theme.colors.danger }}>{anchorError}</AppText>
        ) : null}

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

      {/* Season — collapsible */}
      <View style={{ gap: spacing.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: isSeasonExpanded }}
          accessibilityLabel={isSeasonExpanded ? 'Collapse Season' : 'Expand Season'}
          onPress={() => setIsSeasonExpanded((v) => !v)}
          style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
            <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>Season</AppText>
            {selectedSeason && !isSeasonExpanded ? (
              <View style={{
                backgroundColor: theme.colors.accent,
                borderRadius: 999,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
              }}>
                <AppText variant="eyebrow" style={{ color: '#FFFFFF', letterSpacing: 1 }}>
                  {selectedSeason.charAt(0).toUpperCase() + selectedSeason.slice(1)}
                </AppText>
              </View>
            ) : null}
          </View>
          <View style={{
            alignItems: 'center',
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: 999,
            borderWidth: 1,
            height: 28,
            justifyContent: 'center',
            width: 28,
          }}>
            <AppIcon
              color={theme.colors.text}
              name={isSeasonExpanded ? 'chevron-up' : 'chevron-down'}
              size={14}
            />
          </View>
        </Pressable>
        {isSeasonExpanded ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {SEASON_OPTIONS.map(({ value, label, icon }) => {
              const isSelected = selectedSeason === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setSelectedSeason(isSelected ? null : value)}
                  style={{
                    alignItems: 'center',
                    backgroundColor: isSelected ? theme.colors.accent : theme.colors.surface,
                    borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                    borderRadius: 16,
                    borderWidth: 1,
                    flex: 1,
                    gap: spacing.xs,
                    paddingVertical: spacing.md,
                  }}>
                  <AppIcon color={isSelected ? '#FFFFFF' : theme.colors.text} name={icon} size={18} />
                  <AppText variant="eyebrow" style={{ color: isSelected ? '#FFFFFF' : theme.colors.text, letterSpacing: 1 }}>
                    {label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Style Keywords — collapsible */}
      <View style={{ gap: spacing.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: isKeywordsExpanded }}
          accessibilityLabel={isKeywordsExpanded ? 'Collapse Style Keywords' : 'Expand Style Keywords'}
          onPress={() => setIsKeywordsExpanded((v) => !v)}
          style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>Style Keywords</AppText>
          <View
            style={{
              alignItems: 'center',
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: 999,
              borderWidth: 1,
              height: 28,
              justifyContent: 'center',
              width: 28,
            }}>
            <AppIcon
              color={theme.colors.text}
              name={isKeywordsExpanded ? 'chevron-up' : 'chevron-down'}
              size={14}
            />
          </View>
        </Pressable>
        {isKeywordsExpanded ? (
          <View style={{ gap: spacing.md }}>
            <AppText tone="muted">Keywords that define the aesthetic vibe.</AppText>
            <TextInput
              multiline
              autoCapitalize="words"
              onChangeText={setVibeKeywords}
              placeholder="Describe the aesthetic..."
              placeholderTextColor={theme.colors.subtleText}
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: 18,
                borderWidth: 1,
                color: theme.colors.text,
                fontFamily: theme.fonts.sans,
                fontSize: 16,
                minHeight: 100,
                paddingHorizontal: spacing.md,
                paddingTop: spacing.md,
                textAlignVertical: 'top',
              }}
              value={vibeKeywords}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {VIBE_SUGGESTIONS.map((keyword) => {
                const isSelected = vibeKeywords.split(',').map((k) => k.trim().toLowerCase()).includes(keyword.toLowerCase());
                return (
                  <Pressable
                    key={keyword}
                    onPress={() => toggleVibeKeyword(keyword)}
                    style={{
                      backgroundColor: isSelected ? theme.colors.accent : theme.colors.surface,
                      borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                      borderRadius: 999,
                      borderWidth: 1,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.xs,
                    }}>
                    <AppText style={{ color: isSelected ? '#FFFFFF' : theme.colors.text }}>{keyword}</AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>

      {/* Optional Items */}
      <View style={{ gap: spacing.md }}>
        <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>Optional Items</AppText>
        <View style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: 18,
          borderWidth: 1,
          gap: spacing.xs,
          padding: spacing.md,
        }}>
          <OptionalItemRow
            label="Include a bag"
            description="We'll pick a bag type that suits the look."
            checked={includeBag}
            onToggle={toggleIncludeBag}
          />
          <View style={{ backgroundColor: theme.colors.border, height: 1, marginVertical: spacing.xs }} />
          <OptionalItemRow
            label="Include a hat"
            description="We'll choose a hat that matches the styling direction."
            checked={includeHat}
            onToggle={toggleIncludeHat}
          />
        </View>
      </View>

      {/* Occasion Formality */}
      <View style={{ gap: spacing.md }}>
        <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>Occasion Formality</AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {LOOK_TIER_OPTIONS.map((tier) => {
            const isSelected = selectedTiers.includes(tier);
            const config = TIER_CONFIG[tier];
            return (
              <Pressable
                key={tier}
                onPress={() => toggleTier(tier)}
                style={{
                  alignItems: 'center',
                  backgroundColor: isSelected ? theme.colors.accent : theme.colors.surface,
                  borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                  borderRadius: 20,
                  borderWidth: 1,
                  flex: 1,
                  gap: spacing.sm,
                  padding: spacing.md,
                }}>
                {isSelected ? (
                  <View style={{ position: 'absolute', right: spacing.sm, top: spacing.sm }}>
                    <AppIcon color="#FFFFFF" name="check-circle" size={16} />
                  </View>
                ) : null}
                <AppIcon
                  color={isSelected ? '#FFFFFF' : theme.colors.text}
                  name={config.icon}
                  size={24}
                />
                <AppText
                  variant="eyebrow"
                  style={{
                    color: isSelected ? '#FFFFFF' : theme.colors.text,
                    letterSpacing: 1.2,
                    textAlign: 'center',
                  }}>
                  {config.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        {tierError ? (
          <AppText style={{ color: theme.colors.danger }}>{tierError}</AppText>
        ) : null}
      </View>

      <PrimaryButton
        disabled={!hasAnyInput || isUploading}
        label={isUploading ? 'Uploading image...' : 'Review Request'}
        onPress={onContinue}
      />
    </View>
  );
}
