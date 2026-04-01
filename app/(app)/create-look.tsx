import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { CreateLookRequestForm } from '@/components/forms/create-look-request-form';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { ScreenHeader } from '@/components/ui/screen-header';
import { spacing } from '@/constants/theme';

export default function CreateLookScreen() {
  const { closetItemId, closetItemTitle, closetItemImageUrl } = useLocalSearchParams<{
    closetItemId?: string;
    closetItemTitle?: string;
    closetItemImageUrl?: string;
  }>();

  const anchorItems =
    closetItemId && closetItemTitle && closetItemImageUrl
      ? [
          {
            id: closetItemId,
            description: closetItemTitle,
            image: null,
            uploadedImage: {
              id: closetItemId,
              category: 'anchor-item' as const,
              storageProvider: 'closet-ref',
              storageKey: closetItemImageUrl,
              publicUrl: closetItemImageUrl,
              createdAt: new Date().toISOString(),
            },
          },
        ]
      : [];

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>

        <ScreenHeader title="New Style Brief" showBack />

        {/* Title */}
        <View style={{ gap: spacing.xs }}>
          <AppText variant="heroSmall">Define Your Look</AppText>
          <AppText tone="muted">Start with your core pieces and set the tone.</AppText>
        </View>

        <CreateLookRequestForm
          key={closetItemId ?? 'no-anchor'}
          initialValue={{
            anchorItems,
            anchorItemDescription: closetItemTitle ?? '',
            vibeKeywords: '',
            anchorImage: null,
            uploadedAnchorImage: null,
            photoPending: false,
            selectedTiers: ['business', 'smart-casual', 'casual'],
            weatherContext: null,
          }}
        />
      </View>
    </AppScreen>
  );
}
