import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import type { LocalImageAsset } from '@/types/media';
import { AppText } from '@/components/ui/app-text';
import { FormField } from '@/components/ui/form-field';

type ImagePickerFieldProps = {
  label: string;
  hint: string;
  image: LocalImageAsset | null;
  isPicking?: boolean;
  error?: string | null;
  statusMessage?: string | null;
  futureCameraHint?: string;
  pickLabel?: string;
  cameraLabel?: string;
  onPick: () => void;
  onTakePhoto?: () => void;
  onRemove: () => void;
};

export function ImagePickerField({
  label,
  hint,
  image,
  isPicking = false,
  error,
  statusMessage,
  futureCameraHint = 'Camera capture can be connected here later.',
  pickLabel = 'Choose from library',
  cameraLabel = 'Take photo',
  onPick,
  onTakePhoto,
  onRemove,
}: ImagePickerFieldProps) {
  return (
    <FormField label={label} hint={hint} error={error ?? undefined}>
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: 24,
          borderStyle: image ? 'solid' : 'dashed',
          borderWidth: 1,
          gap: spacing.md,
          overflow: 'hidden',
          padding: image ? 0 : spacing.lg,
        }}>
        {image ? (
          <>
            <Image source={{ uri: image.uri }} style={{ width: '100%', aspectRatio: 4 / 5, backgroundColor: theme.colors.card }} contentFit="cover" />
            <View style={{ gap: spacing.sm, padding: spacing.lg }}>
              <AppText tone="muted">
                {image.fileName || 'Selected image'} {image.width && image.height ? `• ${image.width}x${image.height}` : ''}
              </AppText>
              {statusMessage ? <AppText tone="muted">{statusMessage}</AppText> : null}
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <ActionPill label={isPicking ? 'Replacing...' : 'Replace'} onPress={onPick} />
                {onTakePhoto ? <ActionPill label={isPicking ? 'Opening camera...' : cameraLabel} onPress={onTakePhoto} /> : null}
                <ActionPill label="Remove" onPress={onRemove} />
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={{ gap: spacing.xs }}>
              <AppText variant="title">Add image</AppText>
              <AppText tone="muted">{futureCameraHint}</AppText>
              {statusMessage ? <AppText tone="muted">{statusMessage}</AppText> : null}
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <ActionPill label={isPicking ? 'Opening...' : pickLabel} onPress={onPick} />
              {onTakePhoto ? <ActionPill label={isPicking ? 'Opening camera...' : cameraLabel} onPress={onTakePhoto} /> : null}
            </View>
          </>
        )}
      </View>
    </FormField>
  );
}

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
