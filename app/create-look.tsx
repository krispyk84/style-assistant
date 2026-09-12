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

export default function CreateLookScreen() {
  useEffect(() => { trackCreateLookStarted(); }, []);

  const { closetItemId, closetItemTitle, closetItemImageUrl, closetItemFitStatus, closetOnly, fresh } = useLocalSearchParams<{
    closetItemId?: string;
    closetItemTitle?: string;
    closetItemImageUrl?: string;
    closetItemFitStatus?: string;
    /** Set by the "Build Around a Piece" link inside the Build From My Closet modal, so the form opens with "Pair only items from my closet" already on — keeping that flow's "entirely from your closet" promise true. */
    closetOnly?: string;
    fresh?: string;
  }>();

  const anchorItems = buildAnchorItemsFromClosetParams({
    closetItemId,
    closetItemTitle,
    closetItemImageUrl,
    closetItemFitStatus,
  });

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
          key={closetItemId ? `anchor-${closetItemId}` : `fresh-${fresh ?? 'default'}`}
          initialValue={{
            anchorItems,
            anchorItemDescription: closetItemTitle ?? '',
            vibeKeywords: '',
            anchorImage: null,
            uploadedAnchorImage: null,
            photoPending: false,
            selectedTiers: ['business', 'smart-casual', 'casual'],
            weatherContext: null,
            closetOnly: closetOnly === 'true',
          }}
        />
      </View>
    </AppScreen>
  );
}
