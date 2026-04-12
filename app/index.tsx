import { router } from 'expo-router';
import { useEffect } from 'react';

import { BrandSplash } from '@/components/ui/brand-splash';
import { useAuth } from '@/contexts/auth-context';
import { useAppSession } from '@/hooks/use-app-session';

const ONBOARDING_TEST_MODE = true;

export default function LandingScreen() {
  const { user, isAuthLoading } = useAuth();
  const { hasCompletedOnboarding, isHydrated } = useAppSession();

  const ready = !isAuthLoading && !!user && isHydrated;

  useEffect(() => {
    if (!ready) return;

    if (!hasCompletedOnboarding || ONBOARDING_TEST_MODE) {
      router.replace('/onboarding');
    } else {
      router.replace('/(app)/home');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

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
