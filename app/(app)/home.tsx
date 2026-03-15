import { View } from 'react-native';

import { ActionCard } from '@/components/cards/action-card';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { SectionHeader } from '@/components/ui/section-header';
import { spacing } from '@/constants/theme';

export default function HomeScreen() {
  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="eyebrow">Style Assistant</AppText>
          <AppText variant="hero">Start a new styling request.</AppText>
          <AppText tone="muted">
            Use the app to build a look, check a candidate piece, or preview a selfie-based styling review.
          </AppText>
        </View>

        <View style={{ gap: spacing.md }}>
          <SectionHeader
            title="Start here"
            subtitle="Build the outfit recommendation first, then check pieces against it, then review the final look with a selfie."
          />
          <ActionCard
            title="Create a look"
            description="Start with an anchor item and get tiered outfit recommendations."
            href="/(app)/create-look"
            icon="sparkles-outline"
          />
          <AppText tone="muted">
            Piece checks and selfie review now happen inside the outfit flow after you choose a recommended tier.
          </AppText>
        </View>
      </View>
    </AppScreen>
  );
}
