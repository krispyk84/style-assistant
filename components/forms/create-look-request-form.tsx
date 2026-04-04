import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { spacing, theme } from '@/constants/theme';
import { createMockRequestId } from '@/lib/look-mock-data';
import { buildLookRouteParams } from '@/lib/look-route';
import { loadWeatherContext } from '@/lib/weather-storage';
import type { CreateLookInput, LookAnchorItem, LookTierSlug } from '@/types/look-request';
import { LOOK_TIER_OPTIONS } from '@/types/look-request';
import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useUploadedImage } from '@/hooks/use-uploaded-image';
import { closetService } from '@/services/closet';
import type { ClosetItem } from '@/types/closet';
import { ClosetPickerModal } from '@/components/closet/closet-picker-modal';

const VIBE_SUGGESTIONS = ['Old Money', 'Resort', 'Minimalist', 'European Summer', 'Streetwear', 'Coastal'];

const tierConfig: Record<LookTierSlug, { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  business: { label: 'Business', icon: 'briefcase-outline' },
  'smart-casual': { label: 'Smart\nCasual', icon: 'sparkles-outline' },
  casual: { label: 'Casual', icon: 'cafe-outline' },
};

type CreateLookRequestFormProps = {
  initialValue?: CreateLookInput;
};

function createEmptyAnchorItem(): LookAnchorItem {
  return {
    id: `anchor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: '',
    image: null,
    uploadedImage: null,
  };
}

function buildInitialAnchorItems(initialValue: CreateLookInput): LookAnchorItem[] {
  if (initialValue.anchorItems.length) {
    return initialValue.anchorItems;
  }

  if (initialValue.anchorItemDescription || initialValue.anchorImage || initialValue.uploadedAnchorImage) {
    return [
      {
        id: 'anchor-initial',
        description: initialValue.anchorItemDescription,
        image: initialValue.anchorImage,
        uploadedImage: initialValue.uploadedAnchorImage,
      },
    ];
  }

  return [createEmptyAnchorItem()];
}

export function CreateLookRequestForm({
  initialValue = {
    anchorItems: [],
    anchorItemDescription: '',
    anchorImage: null,
    uploadedAnchorImage: null,
    photoPending: false,
    selectedTiers: ['business', 'smart-casual', 'casual'],
  },
}: CreateLookRequestFormProps) {
  const [anchorItems, setAnchorItems] = useState<LookAnchorItem[]>(() => buildInitialAnchorItems(initialValue));
  const [vibeKeywords, setVibeKeywords] = useState(initialValue.vibeKeywords ?? '');
  const [selectedTiers, setSelectedTiers] = useState<LookTierSlug[]>(initialValue.selectedTiers);
  // Auto-expand if the form was initialised with pre-filled keywords (e.g. anchor flows)
  const [isKeywordsExpanded, setIsKeywordsExpanded] = useState(() => !!(initialValue.vibeKeywords?.trim()));
  const [anchorError, setAnchorError] = useState<string | null>(null);
  const [tierError, setTierError] = useState<string | null>(null);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [closetPickerVisible, setClosetPickerVisible] = useState(false);
  const closetPickerTargetId = useRef<string | null>(null);

  useEffect(() => {
    void closetService.getItems().then((r) => {
      if (r.success && r.data) setClosetItems(r.data.items);
    });
  }, []);

  const populatedAnchorItems = anchorItems.filter((item) => item.description.trim() || item.image || item.uploadedImage);
  const hasAnyInput = populatedAnchorItems.length > 0;
  const isUploading = anchorItems.some((item) => item.uploadedImage === null && item.image !== null);

  function toggleTier(tier: LookTierSlug) {
    setSelectedTiers((current) => {
      const next = current.includes(tier) ? current.filter((item) => item !== tier) : [...current, tier];
      return next;
    });
    setTierError(null);
  }

  // useCallback with empty deps: setAnchorItems and setAnchorError are stable setState
  // dispatchers. Without useCallback, updateAnchorItem gets a new reference every render,
  // which causes AnchorItemCard's useEffect([onChange]) to fire → setAnchorItems →
  // re-render → new reference → infinite loop → "Maximum update depth exceeded" →
  // React unmounts the tree silently (effect errors don't reach ErrorBoundary) → blank screen.
  const updateAnchorItem = useCallback((nextItem: LookAnchorItem) => {
    setAnchorItems((current) => current.map((item) => (item.id === nextItem.id ? nextItem : item)));
    setAnchorError(null);
  }, []);

  function addAnchorItem() {
    setAnchorItems((current) => (current.length >= 5 ? current : [...current, createEmptyAnchorItem()]));
  }

  function removeAnchorItem(itemId: string) {
    setAnchorItems((current) => current.filter((item) => item.id !== itemId));
  }

  function handlePickFromCloset(anchorItemId: string) {
    closetPickerTargetId.current = anchorItemId;
    setClosetPickerVisible(true);
  }

  function handleClosetItemSelected(closetItem: ClosetItem) {
    const imageUrl = closetItem.sketchImageUrl ?? closetItem.uploadedImageUrl ?? '';
    setAnchorItems((current) =>
      current.map((item) => {
        if (item.id !== closetPickerTargetId.current) return item;
        return {
          id: `closet-${closetItem.id}-${Date.now()}`,
          description: closetItem.title,
          image: null,
          uploadedImage: imageUrl
            ? {
                id: closetItem.id,
                category: 'anchor-item' as const,
                storageProvider: 'closet-ref',
                storageKey: imageUrl,
                publicUrl: imageUrl,
                createdAt: new Date().toISOString(),
              }
            : null,
        };
      })
    );
    closetPickerTargetId.current = null;
    setClosetPickerVisible(false);
  }

  function toggleVibeKeyword(keyword: string) {
    setVibeKeywords((current) => {
      const parts = current.split(',').map((k) => k.trim()).filter(Boolean);
      const idx = parts.findIndex((k) => k.toLowerCase() === keyword.toLowerCase());
      if (idx >= 0) {
        parts.splice(idx, 1);
      } else {
        parts.push(keyword);
      }
      return parts.join(', ');
    });
  }

  async function handleContinue() {
    if (!populatedAnchorItems.length) {
      setAnchorError('Add an image, a description, or both before continuing.');
      return;
    }

    if (!selectedTiers.length) {
      setTierError('Select at least one outfit tier.');
      return;
    }

    const requestId = createMockRequestId();
    const weatherContext = await loadWeatherContext();
    const primaryAnchorItem = populatedAnchorItems[0];
    const anchorItemDescription = populatedAnchorItems
      .map((item) => item.description.trim())
      .filter(Boolean)
      .join(' • ');

    router.push({
      pathname: '/review-request',
      params: buildLookRouteParams(requestId, {
        anchorItems: populatedAnchorItems,
        anchorItemDescription,
        vibeKeywords: vibeKeywords.trim(),
        anchorImage: primaryAnchorItem?.image ?? null,
        uploadedAnchorImage: primaryAnchorItem?.uploadedImage ?? null,
        photoPending: !populatedAnchorItems.some((item) => item.image || item.uploadedImage),
        selectedTiers,
        weatherContext,
      }),
    });
  }

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
          <Ionicons color={theme.colors.mutedText} name="add" size={16} />
          <AppText tone="muted">
            {anchorItems.length >= 5 ? 'Maximum of 5 items reached' : 'Add Item'}
          </AppText>
        </Pressable>
      </View>

      <ClosetPickerModal
        visible={closetPickerVisible}
        items={closetItems}
        onSelect={handleClosetItemSelected}
        onClose={() => { closetPickerTargetId.current = null; setClosetPickerVisible(false); }}
      />

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
            <Ionicons
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
                    <Ionicons color="#FFFFFF" name="checkmark-circle" size={16} />
                  </View>
                ) : null}
                <Ionicons
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
        onPress={() => void handleContinue()}
      />
    </View>
  );
}

function AnchorItemCard({
  item,
  isPrimary,
  removable,
  onChange,
  onRemove,
  onPickFromCloset,
}: {
  item: LookAnchorItem;
  isPrimary: boolean;
  removable: boolean;
  onChange: (item: LookAnchorItem) => void;
  onRemove: () => void;
  onPickFromCloset?: () => void;
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

  useEffect(() => {
    onChange({
      id: item.id,
      description,
      image,
      uploadedImage,
    });
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
            <Ionicons color={theme.colors.subtleText} name="close" size={20} />
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
            icon="image-outline"
            label="Library"
            loading={isPickingLibrary}
            onPress={pickFromLibrary}
          />
          <ActionPill
            icon="camera-outline"
            label="Camera"
            loading={isPickingCamera}
            onPress={takePhoto}
          />
          {onPickFromCloset ? (
            <ActionPill
              icon="shirt-outline"
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
      </View>
    </View>
  );
}

// ── Action pill ───────────────────────────────────────────────────────────────

function ActionPill({
  label,
  icon,
  onPress,
  disabled = false,
  loading = false,
}: {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
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
        <Ionicons color={theme.colors.text} name={icon} size={16} />
      ) : null}
      <AppText style={loading ? { color: theme.colors.accent } : undefined}>{label}</AppText>
    </Pressable>
  );
}
