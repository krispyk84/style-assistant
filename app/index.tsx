import { Redirect } from 'expo-router';

import { BrandSplash } from '@/components/ui/brand-splash';
import { useAuth } from '@/contexts/auth-context';
import { useAppSession } from '@/hooks/use-app-session';

export default function LandingScreen() {
  const { user, isAuthLoading } = useAuth();
  const { hasCompletedOnboarding, isHydrated } = useAppSession();

  // 1. Auth session restoring from storage — show splash while Supabase hydrates.
  if (isAuthLoading) {
    return (
      <BrandSplash
        messages={[
          'Loading your Vesture workspace.',
          'Checking your credentials.',
          'Preparing your styling tools.',
        ]}
      />
    );
  }

  // 2. Not authenticated — send to auth flow.
  if (!user) {
    return <Redirect href="/auth" />;
  }

  // 3. Authenticated but app-level session (profile from backend) still loading.
  if (!isHydrated) {
    return (
      <BrandSplash
        messages={[
          'Loading your profile.',
          'Fetching your style settings.',
          'Almost ready.',
        ]}
      />
    );
  }

  // Authenticated + hydrated — route based on onboarding state.
  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(app)/home" />;
}
