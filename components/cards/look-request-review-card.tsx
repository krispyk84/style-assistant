import { View } from 'react-native';
import { Image } from 'expo-image';

import { spacing, theme } from '@/constants/theme';
import type { CreateLookInput } from '@/types/look-request';
import { AppText } from '@/components/ui/app-text';

type LookRequestReviewCardProps = {
  input: CreateLookInput;
};

export function LookRequestReviewCard({ input }: LookRequestReviewCardProps) {
  const description = input.anchorItemDescription.trim();
  const previewUri = input.anchorImage?.uri ?? input.uploadedAnchorImage?.publicUrl ?? null;

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 28,
        borderWidth: 1,
        gap: spacing.md,
        padding: spacing.lg,
      }}>
      {previewUri ? (
        <Image
          source={{ uri: previewUri }}
          style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: 20, backgroundColor: theme.colors.card }}
          contentFit="cover"
        />
      ) : null}
      {description ? <AppText tone="muted">{description}</AppText> : null}
    </View>
  );
}
