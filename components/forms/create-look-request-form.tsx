import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { spacing, theme } from '@/constants/theme';
import { createMockRequestId } from '@/lib/look-mock-data';
import { buildLookRouteParams } from '@/lib/look-route';
import { loadWeatherContext } from '@/lib/weather-storage';
import type { CreateLookInput, LookAnchorItem, LookTierSlug } from '@/types/look-request';
import { LOOK_TIER_OPTIONS } from '@/types/look-request';
import { AppText } from '@/components/ui/app-text';
import { FormField } from '@/components/ui/form-field';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useUploadedImage } from '@/hooks/use-uploaded-image';

const tierLabels: Record<LookTierSlug, string> = {
  business: 'Business',
  'smart-casual': 'Smart Casual',
  casual: 'Casual',
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
  const [selectedTiers, setSelectedTiers] = useState<LookTierSlug[]>(initialValue.selectedTiers);
  const [anchorError, setAnchorError] = useState<string | null>(null);
  const [tierError, setTierError] = useState<string | null>(null);
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

  function updateAnchorItem(nextItem: LookAnchorItem) {
    setAnchorItems((current) => current.map((item) => (item.id === nextItem.id ? nextItem : item)));
    setAnchorError(null);
  }

  function addAnchorItem() {
    setAnchorItems((current) => (current.length >= 5 ? current : [...current, createEmptyAnchorItem()]));
  }

  function removeAnchorItem(itemId: string) {
    setAnchorItems((current) => current.filter((item) => item.id !== itemId));
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
      <FormField error={anchorError ?? undefined} label="Anchor items">
        <View style={{ gap: spacing.md }}>
          {anchorItems.map((item, index) => (
            <AnchorItemCard
              key={item.id}
              item={item}
              removable={index > 0}
              onChange={updateAnchorItem}
              onRemove={() => removeAnchorItem(item.id)}
            />
          ))}
          <Pressable
            disabled={anchorItems.length >= 5}
            onPress={addAnchorItem}
            style={[
              addItemRowStyle,
              { opacity: anchorItems.length >= 5 ? 0.5 : 1 },
            ]}>
            <Ionicons color={theme.colors.text} name="add-outline" size={18} />
            <AppText>{anchorItems.length >= 5 ? 'Maximum of 5 items reached' : 'Add an item'}</AppText>
          </Pressable>
        </View>
      </FormField>

      <FormField
        label="Outfit tiers"
        error={tierError ?? undefined}>
        <View style={{ gap: spacing.sm }}>
          {LOOK_TIER_OPTIONS.map((tier) => {
            const isSelected = selectedTiers.includes(tier);

            return (
              <Pressable
                key={tier}
                onPress={() => toggleTier(tier)}
                style={[
                  tierRowStyle,
                  {
                    borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                  },
                ]}>
                <View style={{ gap: spacing.xs, flex: 1 }}>
                  <AppText variant="sectionTitle">{tierLabels[tier]}</AppText>
                  <AppText tone="muted">
                    {tier === 'business'
                      ? 'Sharper and more structured.'
                      : tier === 'smart-casual'
                        ? 'Balanced and dinner-ready.'
                        : 'Relaxed, clean, and off-duty.'}
                  </AppText>
                </View>
                <AppText tone={isSelected ? 'default' : 'muted'}>{isSelected ? 'Selected' : 'Tap to include'}</AppText>
              </Pressable>
            );
          })}
        </View>
      </FormField>

      <PrimaryButton disabled={!hasAnyInput || isUploading} label={isUploading ? 'Uploading image...' : 'Review request'} onPress={() => void handleContinue()} />
    </View>
  );
}

function AnchorItemCard({
  item,
  removable,
  onChange,
  onRemove,
}: {
  item: LookAnchorItem;
  removable: boolean;
  onChange: (item: LookAnchorItem) => void;
  onRemove: () => void;
}) {
  const [description, setDescription] = useState(item.description);
  const {
    image,
    uploadedImage,
    isPicking,
    isUploading,
    uploadProgress,
    error,
    uploadSuccessMessage,
    pickFromLibrary,
    takePhoto,
    removeImage,
  } = useUploadedImage('anchor-item', item.image);

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
        gap: spacing.md,
        padding: spacing.lg,
      }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText variant="sectionTitle">Anchor item</AppText>
        {removable ? (
          <Pressable hitSlop={8} onPress={async () => {
            if (image || uploadedImage) {
              await removeImage();
            }
            onRemove();
          }}>
            <Ionicons color={theme.colors.subtleText} name="close" size={20} />
          </Pressable>
        ) : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        {image ? (
          <View style={{ gap: spacing.sm }}>
            <View
              style={{
                backgroundColor: theme.colors.card,
                borderRadius: 20,
                overflow: 'hidden',
              }}>
              <ImagePreview uri={image.uri} />
            </View>
            <AppText tone="muted">
              {image.fileName || 'Selected image'} {image.width && image.height ? `• ${image.width}x${image.height}` : ''}
            </AppText>
          </View>
        ) : null}
        {error ? <AppText style={{ color: theme.colors.danger }}>{error}</AppText> : null}
        {isUploading ? <AppText tone="muted">{`Uploading ${Math.round(uploadProgress * 100)}%`}</AppText> : null}
        {!isUploading && uploadedImage ? <AppText tone="muted">{uploadSuccessMessage ?? 'Upload complete.'}</AppText> : null}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <ActionPill label={isPicking ? 'Opening...' : image ? 'Replace' : 'Select photo'} onPress={pickFromLibrary} />
          <ActionPill label={isPicking ? 'Opening camera...' : 'Take photo'} onPress={takePhoto} />
          {image ? <ActionPill label="Remove" onPress={() => void removeImage()} /> : null}
        </View>
      </View>

      <TextInput
        multiline
        numberOfLines={4}
        onChangeText={setDescription}
        placeholder="Add a description"
        placeholderTextColor={theme.colors.subtleText}
        style={[inputStyle, { minHeight: 120, paddingTop: spacing.md, textAlignVertical: 'top' }]}
        value={description}
      />
    </View>
  );
}

function ImagePreview({ uri }: { uri: string }) {
  return (
    <Image source={{ uri }} style={{ aspectRatio: 4 / 5, width: '100%' }} contentFit="cover" />
  );
}

const inputStyle = {
  backgroundColor: theme.colors.surface,
  borderColor: theme.colors.border,
  borderRadius: 18,
  borderWidth: 1,
  color: theme.colors.text,
  fontFamily: theme.fonts.sans,
  fontSize: 16,
  minHeight: 54,
  paddingHorizontal: spacing.md,
} as const;

const tierRowStyle = {
  alignItems: 'center',
  backgroundColor: theme.colors.surface,
  borderRadius: 22,
  borderWidth: 1,
  flexDirection: 'row',
  gap: spacing.md,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.md,
} as const;

const addItemRowStyle = {
  alignItems: 'center',
  alignSelf: 'flex-start',
  flexDirection: 'row',
  gap: spacing.xs,
} as const;

function ActionPill({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: disabled ? theme.colors.card : '#F7F2EE',
        borderColor: theme.colors.border,
        borderRadius: 999,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 44,
        opacity: disabled ? 0.5 : 1,
        paddingHorizontal: spacing.md,
      }}>
      <AppText>{label}</AppText>
    </Pressable>
  );
}
