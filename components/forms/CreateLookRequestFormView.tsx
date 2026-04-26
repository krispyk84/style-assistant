import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Image } from 'expo-image';

import { AppIcon, type AppIconName } from '@/components/ui/app-icon';

import { spacing, theme } from '@/constants/theme';
import type { LookAnchorItem, LookTierSlug } from '@/types/look-request';
import { LOOK_TIER_OPTIONS } from '@/types/look-request';
import type { WeatherSeason } from '@/types/weather';
import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useUploadedImage } from '@/hooks/use-uploaded-image';
import type { ClosetItem } from '@/types/closet';
import { ClosetPickerModal } from '@/components/closet/closet-picker-modal';
import { useRef, useEffect, useState } from 'react';

const VIBE_SUGGESTIONS = ['Old Money', 'Resort', 'Minimalist', 'European Summer', 'Streetwear', 'Coastal'];

const SEASON_OPTIONS: { value: WeatherSeason; label: string; icon: AppIconName }[] = [
  { value: 'spring', label: 'Spring', icon: 'sparkles' },
  { value: 'summer', label: 'Summer', icon: 'sun' },
  { value: 'fall',   label: 'Fall',   icon: 'wind' },
  { value: 'winter', label: 'Winter', icon: 'snow' },
];

const tierConfig: Record<LookTierSlug, { label: string; icon: AppIconName }> = {
  business: { label: 'Business', icon: 'briefcase' },
  'smart-casual': { label: 'Smart\nCasual', icon: 'sparkles' },
  casual: { label: 'Casual', icon: 'coffee' },
};

export type CreateLookRequestFormViewProps = {
  // Anchor items
  anchorItems: LookAnchorItem[];
  anchorError: string | null;
  showAddToClosetCheckbox: boolean;
  shouldAddAnchorToCloset: boolean;
  closetItems: ClosetItem[];
  closetPickerVisible: boolean;
  isUploading: boolean;
  onUpdateAnchorItem: (item: LookAnchorItem) => void;
  onAddAnchorItem: () => void;
  onRemoveAnchorItem: (id: string) => void;
  onPickFromCloset: (id: string) => void;
  onToggleSaveToCloset: () => void;
  onClosetItemSelected: (item: ClosetItem) => void;
  onClosetPickerClose: () => void;
  // Season
  selectedSeason: WeatherSeason | null;
  isSeasonExpanded: boolean;
  onSelectSeason: (season: WeatherSeason | null) => void;
  onToggleSeasonExpanded: () => void;
  // Vibe keywords
  vibeKeywords: string;
  isKeywordsExpanded: boolean;
  onChangeVibeKeywords: (text: string) => void;
  onToggleKeywordsExpanded: () => void;
  onToggleVibeKeyword: (keyword: string) => void;
  // Tiers
  selectedTiers: LookTierSlug[];
  tierError: string | null;
  onToggleTier: (tier: LookTierSlug) => void;
  // Optional items
  includeBag: boolean;
  includeHat: boolean;
  onToggleIncludeBag: () => void;
  onToggleIncludeHat: () => void;
  // Submit
  hasAnyInput: boolean;
  onContinue: () => void;
};

export function CreateLookRequestFormView({
  anchorItems,
  anchorError,
  showAddToClosetCheckbox,
  shouldAddAnchorToCloset,
  closetItems,
  closetPickerVisible,
  isUploading,
  onUpdateAnchorItem,
  onAddAnchorItem,
  onRemoveAnchorItem,
  onPickFromCloset,
  onToggleSaveToCloset,
  onClosetItemSelected,
  onClosetPickerClose,
  selectedSeason,
  isSeasonExpanded,
  onSelectSeason,
  onToggleSeasonExpanded,
  vibeKeywords,
  isKeywordsExpanded,
  onChangeVibeKeywords,
  onToggleKeywordsExpanded,
  onToggleVibeKeyword,
  selectedTiers,
  tierError,
  onToggleTier,
  includeBag,
  includeHat,
  onToggleIncludeBag,
  onToggleIncludeHat,
  hasAnyInput,
  onContinue,
}: CreateLookRequestFormViewProps) {
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
            onChange={onUpdateAnchorItem}
            onRemove={() => onRemoveAnchorItem(item.id)}
            onPickFromCloset={closetItems.length > 0 ? () => onPickFromCloset(item.id) : undefined}
            showSaveToCloset={index === 0 && showAddToClosetCheckbox}
            saveToCloset={shouldAddAnchorToCloset}
            onToggleSaveToCloset={onToggleSaveToCloset}
          />
        ))}

        {anchorError ? (
          <AppText style={{ color: theme.colors.danger }}>{anchorError}</AppText>
        ) : null}

        <Pressable
          disabled={anchorItems.length >= 5}
          onPress={onAddAnchorItem}
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
        onSelect={onClosetItemSelected}
        onClose={onClosetPickerClose}
      />

      {/* Season — collapsible */}
      <View style={{ gap: spacing.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: isSeasonExpanded }}
          accessibilityLabel={isSeasonExpanded ? 'Collapse Season' : 'Expand Season'}
          onPress={onToggleSeasonExpanded}
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
                  onPress={() => onSelectSeason(isSelected ? null : value)}
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
          onPress={onToggleKeywordsExpanded}
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
              onChangeText={onChangeVibeKeywords}
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
                    onPress={() => onToggleVibeKeyword(keyword)}
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
            onToggle={onToggleIncludeBag}
          />
          <View style={{ backgroundColor: theme.colors.border, height: 1, marginVertical: spacing.xs }} />
          <OptionalItemRow
            label="Include a hat"
            description="We'll choose a hat that matches the styling direction."
            checked={includeHat}
            onToggle={onToggleIncludeHat}
          />
        </View>
      </View>

      {/* Occasion Formality */}
      <View style={{ gap: spacing.md }}>
        <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>Occasion Formality</AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {LOOK_TIER_OPTIONS.map((tier) => {
            const isSelected = selectedTiers.includes(tier);
            const config = tierConfig[tier];
            return (
              <Pressable
                key={tier}
                onPress={() => onToggleTier(tier)}
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

// ── AnchorItemCard ─────────────────────────────────────────────────────────────

function AnchorItemCard({
  item,
  isPrimary,
  removable,
  onChange,
  onRemove,
  onPickFromCloset,
  showSaveToCloset = false,
  saveToCloset = false,
  onToggleSaveToCloset,
}: {
  item: LookAnchorItem;
  isPrimary: boolean;
  removable: boolean;
  onChange: (item: LookAnchorItem) => void;
  onRemove: () => void;
  onPickFromCloset?: () => void;
  showSaveToCloset?: boolean;
  saveToCloset?: boolean;
  onToggleSaveToCloset?: () => void;
}) {
  const [description, setDescription] = useState(item.description);
  const {
    image,
    uploadedImage,
    isPickingLibrary,
    isPickingCamera,
    isUploading,
    uploadProgress,
    error,
    uploadSuccessMessage,
    pickFromLibrary,
    takePhoto,
    removeImage,
  } = useUploadedImage('anchor-item', item.image, item.uploadedImage);

  // Skip the mount fire: the parent's anchorItems is already initialised from
  // buildInitialAnchorItems() with the exact same values useState() gives the child,
  // so calling onChange on mount just creates a new-reference object with identical
  // values — a wasted re-render.  Post-mount fires (user types, picks image) are
  // genuine state changes that must propagate to the parent.
  const hasMountedRef = useRef(false);
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    onChange({ id: item.id, description, image, uploadedImage });
  }, [description, image, item.id, onChange, uploadedImage]);

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 24,
        borderWidth: 1,
        overflow: 'hidden',
      }}>

      {/* Badge row */}
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          gap: spacing.xs,
          padding: spacing.md,
          paddingBottom: 0,
        }}>
        <View
          style={{
            borderColor: theme.colors.accent,
            borderRadius: 999,
            borderWidth: 1,
            paddingHorizontal: spacing.sm,
            paddingVertical: 3,
          }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.accent, letterSpacing: 1.4 }}>
            {isPrimary ? 'Primary Anchor' : 'Anchor Item'}
          </AppText>
        </View>
        {isPrimary ? (
          <View
            style={{
              borderColor: theme.colors.text,
              borderRadius: 999,
              borderWidth: 1,
              paddingHorizontal: spacing.sm,
              paddingVertical: 3,
            }}>
            <AppText variant="eyebrow" style={{ letterSpacing: 1.4 }}>Fixed</AppText>
          </View>
        ) : (
          <Pressable
            hitSlop={8}
            onPress={async () => {
              if (image || uploadedImage) {
                await removeImage();
              }
              onRemove();
            }}
            style={{ marginLeft: 'auto' }}>
            <AppIcon color={theme.colors.subtleText} name="close" size={20} />
          </Pressable>
        )}
      </View>

      {/* Content */}
      <View style={{ gap: spacing.md, padding: spacing.md }}>

        {/* Image */}
        {image ? (
          <View style={{ borderRadius: 16, overflow: 'hidden' }}>
            <Image
              contentFit="cover"
              source={{ uri: image.uri }}
              style={{ aspectRatio: 4 / 3, width: '100%' }}
            />
          </View>
        ) : uploadedImage ? (
          <View style={{ borderRadius: 16, overflow: 'hidden' }}>
            <Image
              contentFit="contain"
              source={{ uri: uploadedImage.publicUrl }}
              style={{ aspectRatio: 4 / 3, width: '100%' }}
            />
          </View>
        ) : null}

        {error ? <AppText style={{ color: theme.colors.danger }}>{error}</AppText> : null}
        {isUploading ? (
          <AppText tone="muted">{`Uploading ${Math.round(uploadProgress * 100)}%`}</AppText>
        ) : null}
        {!isUploading && uploadedImage ? (
          <AppText tone="muted">{uploadSuccessMessage ?? 'Upload complete.'}</AppText>
        ) : null}

        {/* Photo buttons — labels are always stable to prevent row reflow */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <ActionPill
            icon="image"
            label="Library"
            loading={isPickingLibrary}
            onPress={pickFromLibrary}
          />
          <ActionPill
            icon="camera"
            label="Camera"
            loading={isPickingCamera}
            onPress={takePhoto}
          />
          {onPickFromCloset ? (
            <ActionPill
              icon="shirt"
              label="Closet"
              onPress={onPickFromCloset}
            />
          ) : null}
        </View>

        {/* Description */}
        <View style={{ gap: spacing.xs }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>
            Item Description
          </AppText>
          <TextInput
            onChangeText={setDescription}
            placeholder="Describe the item..."
            placeholderTextColor={theme.colors.subtleText}
            style={{
              backgroundColor: theme.colors.subtleSurface,
              borderRadius: 14,
              color: theme.colors.text,
              fontFamily: theme.fonts.sans,
              fontSize: 16,
              minHeight: 48,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
            }}
            value={description}
          />
        </View>

        {showSaveToCloset ? (
          <Pressable
            onPress={onToggleSaveToCloset}
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              gap: spacing.sm,
              paddingVertical: spacing.xs,
            }}>
            <AppIcon
              color={saveToCloset ? theme.colors.accent : theme.colors.mutedText}
              name={saveToCloset ? 'check-circle' : 'circle'}
              size={22}
            />
            <AppText tone="muted" style={{ flex: 1, fontSize: 14 }}>
              Save anchor item to my closet
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ── OptionalItemRow ───────────────────────────────────────────────────────────

function OptionalItemRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onToggle}
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.sm,
        paddingVertical: spacing.xs,
      }}>
      <AppIcon
        color={checked ? theme.colors.accent : theme.colors.mutedText}
        name={checked ? 'check-circle' : 'circle'}
        size={22}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText style={{ color: theme.colors.text, fontFamily: theme.fonts.sansMedium, fontSize: 14 }}>
          {label}
        </AppText>
        <AppText tone="muted" style={{ fontSize: 12, lineHeight: 17 }}>
          {description}
        </AppText>
      </View>
    </Pressable>
  );
}

// ── ActionPill ────────────────────────────────────────────────────────────────

function ActionPill({
  label,
  icon,
  onPress,
  disabled = false,
  loading = false,
}: {
  label: string;
  icon?: AppIconName;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.subtleSurface,
        borderColor: loading ? theme.colors.accent : theme.colors.border,
        borderRadius: 999,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing.xs,
        justifyContent: 'center',
        minHeight: 44,
        opacity: disabled ? 0.5 : 1,
        paddingHorizontal: spacing.md,
      }}>
      {loading ? (
        <ActivityIndicator color={theme.colors.accent} size={14} />
      ) : icon ? (
        <AppIcon color={theme.colors.text} name={icon} size={16} />
      ) : null}
      <AppText style={loading ? { color: theme.colors.accent } : undefined}>{label}</AppText>
    </Pressable>
  );
}
