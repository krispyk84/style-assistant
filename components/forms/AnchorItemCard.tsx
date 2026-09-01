import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing, theme } from '@/constants/theme';
import { useUploadedImage } from '@/hooks/use-uploaded-image';
import type { LookAnchorItem } from '@/types/look-request';
import { ActionPill } from './look-form-primitives';

type AnchorItemCardProps = {
  item: LookAnchorItem;
  isPrimary: boolean;
  removable: boolean;
  onChange: (item: LookAnchorItem) => void;
  onRemove: () => void;
  onPickFromCloset?: () => void;
  showSaveToCloset?: boolean;
  saveToCloset?: boolean;
  onToggleSaveToCloset?: () => void;
};

export function AnchorItemCard({
  item,
  isPrimary,
  removable,
  onChange,
  onRemove,
  onPickFromCloset,
  showSaveToCloset = false,
  saveToCloset = false,
  onToggleSaveToCloset,
}: AnchorItemCardProps) {
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
  // values — a wasted re-render. Post-mount fires (user types, picks image) are
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

      {/* Badge row — plain eyebrow caption instead of bordered pills, echoing
          the "Wardrobe Anchors" section header just above this card, rather
          than introducing a separate pill-chrome visual language. */}
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          padding: spacing.md,
          paddingBottom: 0,
        }}>
        <AppText variant="eyebrow" style={{ letterSpacing: 1.4 }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.accent, letterSpacing: 1.4 }}>
            {isPrimary ? 'Primary Anchor' : 'Anchor Item'}
          </AppText>
          {isPrimary ? <AppText variant="eyebrow" tone="subtle" style={{ letterSpacing: 1.4 }}> · Fixed</AppText> : null}
        </AppText>
        {!isPrimary && removable ? (
          <Pressable
            hitSlop={8}
            onPress={async () => {
              if (image || uploadedImage) {
                await removeImage();
              }
              onRemove();
            }}>
            <AppIcon color={theme.colors.subtleText} name="close" size={20} />
          </Pressable>
        ) : null}
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

        {/* Photo buttons — equal width and centered, whether there are 2 or 3 */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <ActionPill
            fullWidth
            icon="image"
            label="Library"
            loading={isPickingLibrary}
            onPress={pickFromLibrary}
          />
          <ActionPill
            fullWidth
            icon="camera"
            label="Camera"
            loading={isPickingCamera}
            onPress={takePhoto}
          />
          {onPickFromCloset ? (
            <ActionPill
              fullWidth
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
