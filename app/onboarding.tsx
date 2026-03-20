import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { View } from 'react-native';

import { ProfileForm } from '@/components/forms/profile-form';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { BrandSplash } from '@/components/ui/brand-splash';
import { SectionHeader } from '@/components/ui/section-header';
import { useToast } from '@/components/ui/toast-provider';
import { spacing, theme } from '@/constants/theme';
import { useAppSession } from '@/hooks/use-app-session';

type StepIndicatorProps = {
  number: number;
  label: string;
  active: boolean;
};

function StepIndicator({ number, label, active }: StepIndicatorProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View 
        style={{ 
          width: 28, 
          height: 28, 
          borderRadius: theme.radius.full,
          backgroundColor: active ? theme.colors.accent : theme.colors.borderSubtle,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <AppText 
          variant="meta" 
          tone={active ? 'inverse' : 'muted'}
          style={{ fontSize: 12 }}
        >
          {number}
        </AppText>
      </View>
      <AppText variant="caption" tone={active ? 'default' : 'subtle'}>{label}</AppText>
    </View>
  );
}

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
    <AppScreen scrollable topInset={false}>
      <View style={{ gap: spacing.xl, paddingTop: spacing.xl }}>
        {/* Welcome Header */}
        <View style={{ alignItems: 'center', gap: spacing.lg }}>
          <View 
            style={{ 
              width: 72, 
              height: 72, 
              borderRadius: theme.radius.xl,
              backgroundColor: theme.colors.accentLight,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="shirt-outline" size={36} color={theme.colors.accent} />
          </View>
          <SectionHeader
            eyebrow="Welcome to Vesture"
            title="Let's Set Up Your Style Profile"
            subtitle="We'll use this information to personalize your outfit recommendations."
            variant="hero"
          />
        </View>

        {/* Progress Steps */}
        <View 
          style={{ 
            flexDirection: 'row', 
            justifyContent: 'center',
            gap: spacing.lg,
            paddingVertical: spacing.md,
          }}>
          <StepIndicator number={1} label="Profile" active={true} />
          <View style={{ width: 40, height: 1, backgroundColor: theme.colors.border, alignSelf: 'center' }} />
          <StepIndicator number={2} label="Style" active={false} />
        </View>

        {/* Form Card */}
        <View
          style={[
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.lg,
              padding: spacing.lg,
            },
            theme.shadows.md,
          ]}>
          <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
            <AppText variant="sectionTitle">Your Details</AppText>
            <AppText variant="caption" tone="muted">
              Fill in your preferences to help us understand your style better.
            </AppText>
          </View>
          
          <ProfileForm
            initialValue={profile}
            submitLabel={isSaving ? 'Setting Up...' : 'Complete Setup'}
            disabled={isSaving}
            onSubmit={async (nextProfile) => {
              const saved = await saveProfile(nextProfile, true);

              if (saved) {
                showToast('Welcome to Vesture! Your profile is ready.', 'success');
                router.replace('/(app)/home');
                return;
              }

              showToast(errorMessage ?? 'Profile could not be saved.', 'error');
            }}
          />
        </View>

        {/* Privacy Note */}
        <View 
          style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: spacing.xs,
            paddingBottom: spacing.lg,
          }}>
          <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.subtleText} />
          <AppText variant="caption" tone="subtle">
            Your data is securely stored and never shared
          </AppText>
        </View>
      </View>
    </AppScreen>
  );
}
