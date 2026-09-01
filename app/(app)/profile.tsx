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
import { useAuth } from '@/contexts/auth-context';
import { useAppSession } from '@/hooks/use-app-session';

// Maps Supabase's auth provider id to a human-readable label.
const PROVIDER_LABELS: Record<string, string> = {
  apple: 'Apple',
  email: 'Email',
  google: 'Google',
};

function formatProvider(provider: string | undefined): string {
  if (!provider) return 'Email';
  return PROVIDER_LABELS[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
}

export default function ProfileScreen() {
  const { isHydrated, isSaving, profile, saveProfile } = useAppSession();
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  if (!isHydrated) {
    return (
      <AppScreen floatingBack>
        <LoadingState label="Loading profile..." />
      </AppScreen>
    );
  }

  return (
    <AppScreen scrollable floatingBack avoidsKeyboard>
      <View style={{ gap: spacing.xl }}>
        <SectionHeader
          title="Profile"
          subtitle="Review and edit the personal inputs that will drive future recommendations."
        />
        {isEditing ? (
          <ProfileForm
            initialValue={profile}
            submitLabel="Save profile"
            disabled={isSaving}
            onSubmit={async (nextProfile) => {
              await saveProfile(nextProfile, true);
              setIsEditing(false);
            }}
          />
        ) : (
          <>
            <View
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: 28,
                borderWidth: 1,
                padding: spacing.lg,
                gap: spacing.sm,
              }}>
              <AppText variant="sectionTitle">Account</AppText>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppText tone="muted">Signed in as</AppText>
                <AppText>{user?.email ?? 'Unknown'}</AppText>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppText tone="muted">Sign-in method</AppText>
                <AppText>{formatProvider(user?.app_metadata.provider)}</AppText>
              </View>
            </View>
            <ProfileSummaryCard profile={profile} />
            <View
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: 28,
                borderWidth: 1,
                padding: spacing.lg,
                gap: spacing.sm,
              }}>
              <AppText variant="sectionTitle">How it works</AppText>
              <AppText tone="muted">
                These values are saved through the backend and reused whenever the styling engine builds recommendations.
              </AppText>
            </View>
            <PrimaryButton
              label="Edit profile"
              onPress={() => setIsEditing(true)}
              variant="secondary"
              style={{ marginTop: spacing.sm }}
            />
          </>
        )}
      </View>
    </AppScreen>
  );
}
