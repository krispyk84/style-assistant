import { Redirect } from 'expo-router';
import { BrandSplash } from '@/components/ui/brand-splash';
import { useAppSession } from '@/hooks/use-app-session';

export default function LandingScreen() {
  const { hasCompletedOnboarding, isHydrated } = useAppSession();

  if (!isHydrated) {
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
