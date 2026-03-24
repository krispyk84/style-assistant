import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { CreateLookRequestForm } from '@/components/forms/create-look-request-form';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { spacing, theme } from '@/constants/theme';

export default function CreateLookScreen() {
  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>

        {/* Header */}
        <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
          <Pressable hitSlop={8} onPress={() => router.back()}>
            <Ionicons color={theme.colors.text} name="chevron-back" size={24} />
          </Pressable>
          <AppText variant="eyebrow" style={{ letterSpacing: 2 }}>New Style Brief</AppText>
          <View style={{ width: 24 }} />
        </View>

        {/* Title */}
        <View style={{ gap: spacing.xs }}>
          <AppText variant="heroSmall">Define Your Look</AppText>
          <AppText tone="muted">Start with your core pieces and set the tone.</AppText>
        </View>

        <CreateLookRequestForm
          initialValue={{
            anchorItems: [],
            anchorItemDescription: '',
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
