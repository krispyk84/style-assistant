import { Image, View } from 'react-native';

import { ActionCard } from '@/components/cards/action-card';
import { AppScreen } from '@/components/ui/app-screen';
import { spacing } from '@/constants/theme';

export default function HomeScreen() {
  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl, paddingTop: spacing.lg }}>
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Image
            source={require('../../logo.png')}
            style={{
              height: 140,
              resizeMode: 'contain',
              width: 220,
            }}
          />
        </View>

        <View style={{ gap: spacing.md }}>
          <ActionCard
            title="Create a look"
            description="Start with an anchor item and get tiered outfit recommendations."
            href="/(app)/create-look"
            icon="sparkles-outline"
          />
        </View>
      </View>
    </AppScreen>
  );
}
