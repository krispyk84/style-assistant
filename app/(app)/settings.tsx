import { View } from 'react-native';

import { ActionCard } from '@/components/cards/action-card';
import { AppScreen } from '@/components/ui/app-screen';
import { SectionHeader } from '@/components/ui/section-header';
import { spacing } from '@/constants/theme';

export default function SettingsScreen() {
  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.lg }}>
        <SectionHeader
          title="Settings"
          subtitle="Reserve space for preferences, notifications, privacy controls, and product configuration."
        />
        <ActionCard
          title="Onboarding preferences"
          description="Review the profile choices that shape future styling advice."
          href="/onboarding"
          icon="options-outline"
        />
        <ActionCard
          title="Look tiers"
          description="Inspect the mocked Business, Smart Casual, and Casual outfit tiers."
          href="/tier/business"
          icon="pricetag-outline"
        />
        <ActionCard
          title="Prototype status"
          description="Backend, AI, auth, and camera are intentionally deferred in this foundation build."
          icon="information-circle-outline"
        />
      </View>
    </AppScreen>
  );
}
