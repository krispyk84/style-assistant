import Constants from 'expo-constants';
import { useState } from 'react';
import { View } from 'react-native';

import { ProfileForm } from '@/components/forms/profile-form';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { SectionHeader } from '@/components/ui/section-header';
import { spacing, theme } from '@/constants/theme';
import { useAppSession } from '@/hooks/use-app-session';

const appVersion = Constants.expoConfig?.version ?? Constants.manifest2?.extra?.expoClient?.version ?? '1.0.0';

export default function SettingsScreen() {
  const { isSaving, profile, saveProfile } = useAppSession();
  const [isSavedMessageVisible, setIsSavedMessageVisible] = useState(false);

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.lg }}>
        <SectionHeader title="Settings" subtitle="Profile and app details." />
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: 28,
            borderWidth: 1,
            padding: spacing.lg,
          }}>
          <ProfileForm
            initialValue={profile}
            submitLabel={isSaving ? 'Saving...' : 'Save profile'}
            disabled={isSaving}
            onSubmit={async (nextProfile) => {
              await saveProfile(nextProfile, true);
              setIsSavedMessageVisible(true);
            }}
          />
          {isSavedMessageVisible ? <AppText tone="muted">Profile updated.</AppText> : null}
        </View>
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: 28,
            borderWidth: 1,
            gap: spacing.sm,
            padding: spacing.lg,
          }}>
          <AppText variant="sectionTitle">App version</AppText>
          <AppText tone="muted">Vesture {appVersion}</AppText>
        </View>
      </View>
    </AppScreen>
  );
}
