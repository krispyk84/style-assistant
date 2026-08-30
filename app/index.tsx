import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { BrandSplash } from '@/components/ui/brand-splash';
import { useAuth } from '@/contexts/auth-context';
import { useAppSession } from '@/hooks/use-app-session';

export default function LandingScreen() {
  const { user, isAuthLoading } = useAuth();
  const { hasCompletedOnboarding, isHydrated } = useAppSession();

  // This screen's own first render already looks identical to the native
  // launch screen (same BrandSplash) — hide the native one now so the
  // handoff is an instant swap, not a cross-fade between two near-identical
  // frames (which is what actually caused the flicker).
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

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
