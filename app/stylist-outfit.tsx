import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { StylistOutfitForm } from '@/components/forms/stylist-outfit-form';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { ScreenHeader } from '@/components/ui/screen-header';
import { spacing } from '@/constants/theme';
import { trackAskStylistStarted } from '@/lib/analytics';

export default function StylistOutfitScreen() {
  useEffect(() => { trackAskStylistStarted(); }, []);

  const { swapDayTitle, swapTripId, swapContextLine, swapClosetOnly } = useLocalSearchParams<{
    /** Set only when launched from a trip day's "Swap outfit" action (see useTripResultsActions.ts's handleSwapOutfit) — pre-seeds the brief/closet-only default from that day. */
    swapDayTitle?: string;
    swapTripId?: string;
    swapContextLine?: string;
    swapClosetOnly?: string;
  }>();

  return (
    <AppScreen scrollable floatingBack avoidsKeyboard>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
        <ScreenHeader title="Ask a Stylist" showBack />

        <View style={{ gap: spacing.xs }}>
          <AppText variant="heroSmall">Talk It Through</AppText>
          <AppText tone="muted">Pick your pieces, choose a stylist, and tell them what you need.</AppText>
        </View>

        <StylistOutfitForm
          initialBrief={swapContextLine}
          initialClosetOnly={swapClosetOnly === 'true'}
          swapDayTitle={swapDayTitle}
          swapTripId={swapTripId}
        />
      </View>
    </AppScreen>
  );
}
