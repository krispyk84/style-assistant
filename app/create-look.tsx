import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { CreateLookRequestForm } from '@/components/forms/create-look-request-form';
import { buildAnchorItemsFromClosetParams } from '@/components/forms/createLookRequest-mappers';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { ScreenHeader } from '@/components/ui/screen-header';
import { spacing } from '@/constants/theme';
import { trackCreateLookStarted } from '@/lib/analytics';
import { LOOK_TIER_OPTIONS, type LookTierSlug } from '@/types/look-request';

export default function CreateLookScreen() {
  useEffect(() => { trackCreateLookStarted(); }, []);

  const {
    closetItemId, closetItemTitle, closetItemImageUrl, closetItemFitStatus, closetOnly, fresh,
    swapDayTitle, swapTripId, swapSavedTripId, swapContextLine, swapClosetOnly, swapFormality,
  } = useLocalSearchParams<{
    closetItemId?: string;
    closetItemTitle?: string;
    closetItemImageUrl?: string;
    closetItemFitStatus?: string;
    /** Set by the "Build Around a Piece" link inside the Build From My Closet modal, so the form opens with "Pair only items from my closet" already on — keeping that flow's "entirely from your closet" promise true. */
    closetOnly?: string;
    fresh?: string;
    /** Set only when launched from a trip day's "Swap outfit" action (see useTripResultsActions.ts's handleSwapOutfit) — locks the tier and pre-seeds context/closet-only from that day. */
    swapDayTitle?: string;
    swapTripId?: string;
    /** Present only if the trip is already saved to the backend — carried through so the eventual return trip (MultiLookResults.tsx's dismissTo) doesn't drop it and force a stale local-storage reload. */
    swapSavedTripId?: string;
    swapContextLine?: string;
    swapClosetOnly?: string;
    swapFormality?: string;
  }>();

  const anchorItems = buildAnchorItemsFromClosetParams({
    closetItemId,
    closetItemTitle,
    closetItemImageUrl,
    closetItemFitStatus,
  });

  const lockedTier: LookTierSlug | undefined =
    swapFormality && LOOK_TIER_OPTIONS.includes(swapFormality as LookTierSlug) ? (swapFormality as LookTierSlug) : undefined;

  return (
    <AppScreen scrollable floatingBack avoidsKeyboard>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>

        <ScreenHeader title="New Style Brief" showBack />

        {/* Title */}
        <View style={{ gap: spacing.xs }}>
          <AppText variant="heroSmall">Define Your Look</AppText>
          <AppText tone="muted">Start with your core pieces and set the tone.</AppText>
        </View>

        <CreateLookRequestForm
          key={swapDayTitle ? `swap-${swapDayTitle}` : closetItemId ? `anchor-${closetItemId}` : `fresh-${fresh ?? 'default'}`}
          initialValue={{
            anchorItems,
            anchorItemDescription: closetItemTitle ?? '',
            vibeKeywords: '',
            anchorImage: null,
            uploadedAnchorImage: null,
            photoPending: false,
            selectedTiers: lockedTier ? [lockedTier] : ['business', 'smart-casual', 'casual'],
            weatherContext: null,
            closetOnly: swapDayTitle ? swapClosetOnly === 'true' : closetOnly === 'true',
            additionalDetails: swapContextLine,
          }}
          lockedTier={lockedTier}
          swapDayTitle={swapDayTitle}
          swapTripId={swapTripId}
          swapSavedTripId={swapSavedTripId}
        />
      </View>
    </AppScreen>
  );
}
