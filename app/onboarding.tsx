import { Redirect, router } from 'expo-router';
import { View } from 'react-native';

import { ProfileForm } from '@/components/forms/profile-form';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { BrandSplash } from '@/components/ui/brand-splash';
import { SectionHeader } from '@/components/ui/section-header';
import { useToast } from '@/components/ui/toast-provider';
import { spacing } from '@/constants/theme';
import { useAppSession } from '@/hooks/use-app-session';

export default function OnboardingScreen() {
  const { hasCompletedOnboarding, isHydrated, isSaving, profile, saveProfile, errorMessage } = useAppSession();
  const { showToast } = useToast();

  if (!isHydrated) {
    return (
      <BrandSplash
        messages={[
          'Preparing your Vesture onboarding.',
          'Loading your profile details.',
          'Getting your style setup ready.',
        ]}
      />
    );
  }

  if (hasCompletedOnboarding) {
    return <Redirect href="/(app)/home" />;
  }

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl }}>
        <SectionHeader
          title="Onboarding"
          subtitle="Set the baseline profile the styling assistant will use for fit, palette, and purchase guidance."
        />
        <AppText tone="muted">
          These details are saved through the backend and used to personalize recommendations across the app.
        </AppText>
        <ProfileForm
          initialValue={profile}
          submitLabel="Complete onboarding"
          disabled={isSaving}
          onSubmit={async (nextProfile) => {
            const saved = await saveProfile(nextProfile, true);

            if (saved) {
              showToast('Profile saved to the backend.', 'success');
              router.replace('/(app)/home');
              return;
            }

            showToast(errorMessage ?? 'Profile could not be saved.', 'error');
          }}
        />
      </View>
    </AppScreen>
  );
}
