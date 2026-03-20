import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BrandSplash } from '@/components/ui/brand-splash';
import { useAppSession } from '@/hooks/use-app-session';

export default function LandingScreen() {
  const { hasCompletedOnboarding, isHydrated } = useAppSession();
  const launchedAtRef = useRef(Date.now());
  const [hasShownMinimumSplash, setHasShownMinimumSplash] = useState(false);

  useEffect(() => {
    const remainingMs = Math.max(0, 3000 - (Date.now() - launchedAtRef.current));
    const timeout = setTimeout(() => {
      setHasShownMinimumSplash(true);
    }, remainingMs);

    return () => clearTimeout(timeout);
  }, []);

  if (!isHydrated || !hasShownMinimumSplash) {
    return (
      <BrandSplash
        messages={[
          'Preparing your Vesture profile.',
          'Syncing your personal style preferences.',
          'Getting your wardrobe workspace ready.',
        ]}
      />
    );
  }

  return <Redirect href={hasCompletedOnboarding ? '/(app)/home' : '/onboarding'} />;
}
