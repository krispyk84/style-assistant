import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, TextInput, View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import { createMockRequestId } from '@/lib/look-mock-data';
import { buildLookRouteParams } from '@/lib/look-route';
import type { CreateLookInput, LookTierSlug } from '@/types/look-request';
import { LOOK_TIER_OPTIONS } from '@/types/look-request';
import { AppText } from '@/components/ui/app-text';
import { FormField } from '@/components/ui/form-field';
import { ImagePickerField } from '@/components/forms/image-picker-field';
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

export function CreateLookRequestForm({
  initialValue = {
    anchorItemDescription: '',
    anchorImage: null,
    uploadedAnchorImage: null,
    photoPending: false,
    selectedTiers: ['business', 'smart-casual', 'casual'],
  },
}: CreateLookRequestFormProps) {
  const [anchorItemDescription, setAnchorItemDescription] = useState(initialValue.anchorItemDescription);
  const [selectedTiers, setSelectedTiers] = useState<LookTierSlug[]>(initialValue.selectedTiers);
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
  } =
    useUploadedImage('anchor-item', initialValue.anchorImage);
  const [anchorError, setAnchorError] = useState<string | null>(null);
  const [tierError, setTierError] = useState<string | null>(null);
  const trimmedAnchor = anchorItemDescription.trim();
  const hasAnyInput = Boolean(trimmedAnchor || image);

  function toggleTier(tier: LookTierSlug) {
    setSelectedTiers((current) => {
      const next = current.includes(tier) ? current.filter((item) => item !== tier) : [...current, tier];
      return next;
    });
    setTierError(null);
  }

  function handleContinue() {
    if (!trimmedAnchor && !image) {
      setAnchorError('Add an image, a description, or both before continuing.');
      return;
    }

    if (selectedTiers.length !== LOOK_TIER_OPTIONS.length) {
      setTierError('This comparison flow requires all three outfit tiers.');
      return;
    }

    const requestId = createMockRequestId();

    router.push({
      pathname: '/review-request',
      params: buildLookRouteParams(requestId, {
        anchorItemDescription: trimmedAnchor,
        anchorImage: image,
        uploadedAnchorImage: uploadedImage,
        photoPending: !image,
        selectedTiers,
      }),
    });
  }

  return (
    <View style={{ gap: spacing.xl }}>
      <ImagePickerField
        label="Anchor item image"
        hint="Choose a reference image for the item you want styled."
        image={image}
        isPicking={isPicking || isUploading}
        error={error}
        statusMessage={
          isUploading
            ? `Uploading ${Math.round(uploadProgress * 100)}%`
            : uploadedImage
              ? uploadSuccessMessage ?? 'Upload complete.'
              : null
        }
        pickLabel={isUploading ? `Uploading ${Math.round(uploadProgress * 100)}%` : 'Choose from library'}
        cameraLabel="Take photo"
        futureCameraHint="Use your library or capture the anchor item directly with the camera."
        onPick={pickFromLibrary}
        onTakePhoto={takePhoto}
        onRemove={removeImage}
      />

      <FormField
        label="Anchor item"
        hint="Add a short description if you want to give more context."
        error={anchorError ?? undefined}>
        <TextInput
          multiline
          numberOfLines={4}
          onChangeText={(value) => {
            setAnchorItemDescription(value);
            setAnchorError(null);
          }}
          placeholder="Example: Dark olive chore jacket with a structured shoulder"
          placeholderTextColor={theme.colors.subtleText}
          style={[inputStyle, { minHeight: 132, paddingTop: spacing.md, textAlignVertical: 'top' }]}
          value={anchorItemDescription}
        />
      </FormField>

      <FormField
        label="Outfit tiers"
        hint="This mocked comparison returns one outfit for each tier, so all three should stay selected."
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

      <PrimaryButton disabled={!hasAnyInput || isUploading} label={isUploading ? 'Uploading image...' : 'Review request'} onPress={handleContinue} />
    </View>
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
