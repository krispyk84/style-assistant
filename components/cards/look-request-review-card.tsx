import { View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import type { CreateLookInput, LookTierSlug } from '@/types/look-request';
import { AppText } from '@/components/ui/app-text';
import { RemoteImagePanel } from '@/components/ui/remote-image-panel';

type LookRequestReviewCardProps = {
  input: CreateLookInput;
};

export function LookRequestReviewCard({ input }: LookRequestReviewCardProps) {
  const description = input.anchorItemDescription.trim();
  const previewUri = input.anchorImage?.uri ?? input.uploadedAnchorImage?.publicUrl ?? null;
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
      {previewUri ? (
        <RemoteImagePanel
          uri={previewUri}
          aspectRatio={4 / 5}
          minHeight={320}
          fallbackTitle="Anchor image unavailable"
          fallbackMessage="The uploaded reference image could not be displayed."
        />
      ) : null}
      {selectedTierLabels ? <AppText variant="sectionTitle">{selectedTierLabels}</AppText> : null}
      {description ? <AppText tone="muted">{description}</AppText> : null}
    </View>
  );
}

function formatTierLabel(tier: LookTierSlug) {
  if (tier === 'smart-casual') {
    return 'Smart Casual';
  }

  return tier.charAt(0).toUpperCase() + tier.slice(1);
}
