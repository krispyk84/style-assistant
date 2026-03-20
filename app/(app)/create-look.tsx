import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { CreateLookRequestForm } from '@/components/forms/create-look-request-form';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { SectionHeader } from '@/components/ui/section-header';
import { spacing, theme } from '@/constants/theme';

export default function CreateLookScreen() {
  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl }}>
        <SectionHeader 
          eyebrow="Style Generator"
          title="Create Your Look"
          subtitle="Start with an anchor piece and let AI build outfit options for you."
          variant="page"
        />
        
        {/* Info Banner */}
        <View 
          style={[
            { 
              flexDirection: 'row',
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.lg,
              padding: spacing.md,
              gap: spacing.md,
              alignItems: 'flex-start',
            },
            theme.shadows.sm,
          ]}>
          <View 
            style={{ 
              width: 40, 
              height: 40, 
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.accentLight,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="sparkles" size={20} color={theme.colors.accent} />
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText variant="sectionTitle">How it works</AppText>
            <AppText variant="caption" tone="muted">
              Upload or describe your anchor item. We'll generate outfit recommendations across different style tiers based on your profile and weather.
            </AppText>
          </View>
        </View>

        {/* Form */}
        <View
          style={[
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.lg,
              padding: spacing.lg,
            },
            theme.shadows.md,
          ]}>
          <CreateLookRequestForm
            initialValue={{
              anchorItems: [],
              anchorItemDescription: '',
              anchorImage: null,
              uploadedAnchorImage: null,
              photoPending: false,
              selectedTiers: ['business', 'smart-casual', 'casual'],
              weatherContext: null,
            }}
          />
        </View>
      </View>
    </AppScreen>
  );
}
