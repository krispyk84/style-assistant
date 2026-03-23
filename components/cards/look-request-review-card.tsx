import { View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import { formatTierLabel } from '@/lib/outfit-utils';
import type { CreateLookInput } from '@/types/look-request';
import { AppText } from '@/components/ui/app-text';
import { RemoteImagePanel } from '@/components/ui/remote-image-panel';

type LookRequestReviewCardProps = {
  input: CreateLookInput;
};

export function LookRequestReviewCard({ input }: LookRequestReviewCardProps) {
  const selectedTierLabels = input.selectedTiers.map(formatTierLabel).join(' • ');

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
      {selectedTierLabels ? <AppText variant="sectionTitle">{selectedTierLabels}</AppText> : null}
      {input.anchorItems.map((item, index) => {
        const previewUri = item.image?.uri ?? item.uploadedImage?.publicUrl ?? null;
        const description = item.description.trim();

        return (
          <View
            key={item.id}
            style={{
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              borderRadius: 22,
              borderWidth: 1,
              gap: spacing.md,
              padding: spacing.md,
            }}>
            <AppText variant="sectionTitle">Item {index + 1}</AppText>
            {previewUri ? (
              <RemoteImagePanel
                uri={previewUri}
                aspectRatio={4 / 5}
                minHeight={280}
                fallbackTitle="Anchor image unavailable"
                fallbackMessage="The uploaded reference image could not be displayed."
              />
            ) : null}
            {description ? <AppText tone="muted">{description}</AppText> : null}
          </View>
        );
      })}
    </View>
  );
}

