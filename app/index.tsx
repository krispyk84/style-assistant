import { Redirect } from 'expo-router';
import { AppScreen } from '@/components/ui/app-screen';
import { LoadingState } from '@/components/ui/loading-state';
import { useAppSession } from '@/hooks/use-app-session';

export default function LandingScreen() {
  const { hasCompletedOnboarding, isHydrated } = useAppSession();

  if (!isHydrated) {
    return (
      <AppScreen>
        <LoadingState label="Loading your local Style Assistant profile..." />
      </AppScreen>
    );
  }

  return <Redirect href={hasCompletedOnboarding ? '/(app)/home' : '/onboarding'} />;
}
