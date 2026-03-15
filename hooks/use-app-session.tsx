import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';

import { defaultProfile } from '@/lib/default-profile';
import type { Profile } from '@/types/profile';
import { profileService } from '@/services/profile';

type AppSessionValue = {
  hasCompletedOnboarding: boolean;
  isHydrated: boolean;
  isSaving: boolean;
  profile: Profile;
  errorMessage: string | null;
  saveProfile: (profile: Profile, completeOnboarding?: boolean) => Promise<boolean>;
};

const AppSessionContext = createContext<AppSessionValue | null>(null);

export function AppSessionProvider({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState(defaultProfile);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      const response = await profileService.loadSession();

      if (!isMounted) {
        return;
      }

      if (!response.success) {
        setErrorMessage(response.error?.message ?? 'Failed to load session.');
        setProfile(defaultProfile);
        setHasCompletedOnboarding(false);
        setIsHydrated(true);
        return;
      }

      setErrorMessage(null);
      setProfile(response.data?.profile ?? defaultProfile);
      setHasCompletedOnboarding(response.data?.onboardingCompleted ?? false);
      setIsHydrated(true);
    }

    hydrate();

    return () => {
      isMounted = false;
    };
  }, []);

  async function saveProfile(nextProfile: Profile, completeOnboarding = hasCompletedOnboarding) {
    setIsSaving(true);
    setErrorMessage(null);
    const response = await profileService.saveProfile({
      profile: nextProfile,
      onboardingCompleted: completeOnboarding,
    });

    if (response.success && response.data) {
      setProfile(response.data.profile ?? defaultProfile);
      setHasCompletedOnboarding(response.data.onboardingCompleted);
      setIsSaving(false);
      return true;
    } else {
      setErrorMessage(response.error?.message ?? 'Failed to save profile.');
    }

    setIsSaving(false);
    return false;
  }

  return (
    <AppSessionContext.Provider
      value={{
        hasCompletedOnboarding,
        isHydrated,
        isSaving,
        profile,
        errorMessage,
        saveProfile,
      }}>
      {children}
    </AppSessionContext.Provider>
  );
}

export function useAppSession() {
  const context = useContext(AppSessionContext);

  if (!context) {
    throw new Error('useAppSession must be used within AppSessionProvider');
  }

  return context;
}
