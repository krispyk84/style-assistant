import { Redirect } from 'expo-router';

import { BrandSplash } from '@/components/ui/brand-splash';
import { useAuth } from '@/contexts/auth-context';
import { useAppSession } from '@/hooks/use-app-session';

export default function LandingScreen() {
  const { user, isAuthLoading } = useAuth();
  const { hasCompletedOnboarding, isHydrated } = useAppSession();

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

  if (!user) {
    return <Redirect href="/auth" />;
  }

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

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(app)/home" />;
}
