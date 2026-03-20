import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';

import { ProfileSummaryCard } from '@/components/cards/profile-summary-card';
import { ProfileForm } from '@/components/forms/profile-form';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { LoadingState } from '@/components/ui/loading-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionHeader } from '@/components/ui/section-header';
import { spacing, theme } from '@/constants/theme';
import { useAppSession } from '@/hooks/use-app-session';

export default function ProfileScreen() {
  const { isHydrated, isSaving, profile, saveProfile } = useAppSession();
  const [isEditing, setIsEditing] = useState(false);

  if (!isHydrated) {
    return (
      <AppScreen>
        <LoadingState label="Loading profile..." />
      </AppScreen>
    );
  }

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl }}>
        <SectionHeader
          eyebrow="Your Profile"
          title="Style Preferences"
          subtitle="These inputs drive personalized outfit recommendations."
          variant="page"
        />
        {isEditing ? (
          <View 
            style={[
              { 
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.lg,
                padding: spacing.lg,
              },
              theme.shadows.md,
            ]}>
            <ProfileForm
              initialValue={profile}
              submitLabel="Save Changes"
              disabled={isSaving}
              onSubmit={async (nextProfile) => {
                await saveProfile(nextProfile, true);
                setIsEditing(false);
              }}
            />
          </View>
        ) : (
          <>
            <ProfileSummaryCard profile={profile} />
            
            <View
              style={[
                {
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radius.lg,
                  padding: spacing.lg,
                  gap: spacing.md,
                },
                theme.shadows.sm,
              ]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View 
                  style={{ 
                    width: 36, 
                    height: 36, 
                    borderRadius: theme.radius.sm,
                    backgroundColor: theme.colors.successLight,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.success} />
                </View>
                <AppText variant="sectionTitle">Profile Active</AppText>
              </View>
              <AppText variant="caption" tone="muted">
                Your style preferences are synced and will be used to generate personalized outfit recommendations.
              </AppText>
            </View>
            
            <PrimaryButton
              label="Edit Profile"
              icon="create-outline"
              iconPosition="left"
              onPress={() => setIsEditing(true)}
              variant="secondary"
            />
          </>
        )}
      </View>
    </AppScreen>
  );
}
