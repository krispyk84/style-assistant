import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';

import { defaultProfile } from '@/lib/default-profile';
import { loadSession as loadStoredSession, saveProfile as saveStoredProfile } from '@/lib/profile-storage';
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
      try {
        const cachedSession = await loadStoredSession();

        if (!isMounted) {
          return;
        }

        setProfile(cachedSession.profile ?? defaultProfile);
        setHasCompletedOnboarding(cachedSession.onboardingCompleted);
        setIsHydrated(true);
      } catch {
        if (!isMounted) {
          return;
        }

        setProfile(defaultProfile);
        setHasCompletedOnboarding(false);
        setIsHydrated(true);
      }

      try {
        const response = await profileService.loadSession();

        if (!isMounted) {
          return;
        }

        if (!response.success) {
          setErrorMessage(response.error?.message ?? 'Failed to load session.');
          return;
        }

        const nextProfile = response.data?.profile ?? defaultProfile;
        const nextOnboardingCompleted = response.data?.onboardingCompleted ?? false;

        setErrorMessage(null);
        setProfile(nextProfile);
        setHasCompletedOnboarding(nextOnboardingCompleted);
        await saveStoredProfile(nextProfile, nextOnboardingCompleted);
      } catch {
        if (!isMounted) {
          return;
        }

        setErrorMessage('Failed to load session.');
      }
    }

    void hydrate();

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
      const nextProfile = response.data.profile ?? defaultProfile;
      const nextOnboardingCompleted = response.data.onboardingCompleted;

      setProfile(nextProfile);
      setHasCompletedOnboarding(nextOnboardingCompleted);
      await saveStoredProfile(nextProfile, nextOnboardingCompleted);
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
