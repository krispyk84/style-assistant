import { View } from 'react-native';

import { CreateLookRequestForm } from '@/components/forms/create-look-request-form';
import { AppScreen } from '@/components/ui/app-screen';
import { SectionHeader } from '@/components/ui/section-header';
import { spacing } from '@/constants/theme';

export default function CreateLookScreen() {
  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl }}>
        <SectionHeader title="Create a look" />
        <CreateLookRequestForm
          initialValue={{
            anchorItemDescription: '',
            anchorImage: null,
            uploadedAnchorImage: null,
            photoPending: false,
            selectedTiers: ['business', 'smart-casual', 'casual'],
          }}
        />
      </View>
    </AppScreen>
  );
}
