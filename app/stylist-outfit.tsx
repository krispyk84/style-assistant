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

  return (
    <AppScreen scrollable floatingBack avoidsKeyboard>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
        <ScreenHeader title="Ask a Stylist" showBack />

        <View style={{ gap: spacing.xs }}>
          <AppText variant="heroSmall">Talk It Through</AppText>
          <AppText tone="muted">Pick your pieces, choose a stylist, and tell them what you need.</AppText>
        </View>

        <StylistOutfitForm />
      </View>
    </AppScreen>
  );
}
