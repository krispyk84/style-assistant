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

  const { swapDayTitle, swapTripId, swapSavedTripId, swapContextLine, swapClosetOnly } = useLocalSearchParams<{
    /** Set only when launched from a trip day's "Swap outfit" action (see useTripResultsActions.ts's handleSwapOutfit) — pre-seeds the brief/closet-only default from that day. */
    swapDayTitle?: string;
    swapTripId?: string;
    /** Present only if the trip is already saved to the backend — carried through so the eventual return trip (MultiLookResults.tsx's dismissTo) doesn't drop it and force a stale local-storage reload. */
    swapSavedTripId?: string;
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
          swapSavedTripId={swapSavedTripId}
        />
      </View>
    </AppScreen>
  );
}
