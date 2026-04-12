import { PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { defaultProfile } from '@/lib/default-profile';
import { loadSession as loadStoredSession, saveProfile as saveStoredProfile } from '@/lib/profile-storage';
import type { Profile } from '@/types/profile';
import { profileService } from '@/services/profile';
import { AppSessionContext } from '@/contexts/app-session-context';

const APP_RELAUNCH_RESET_MS = 1000 * 60 * 10; // 10 minutes
const STALE_THRESHOLD_MS = 1000 * 60 * 10; // 10 min — server may have spun down

export function AppSessionProvider({ children }: PropsWithChildren) {
  const { user, isAuthLoading } = useAuth();
  const [profile, setProfile] = useState(defaultProfile);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [appInstanceKey, setAppInstanceKey] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const lastBackgroundedAtRef = useRef<number | null>(null);
  // undefined = not yet initialized (auth still loading); null = signed out
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  async function refreshSessionFromBackend() {
    const response = await profileService.loadSession();

    if (!response.success) {
      setErrorMessage(response.error?.message ?? 'Failed to load session.');
      return;
    }

    // Backend has no record for this user (e.g. existing profile predates
    // supabaseUserId scoping). Preserve local cached state rather than
    // overwriting hasCompletedOnboarding with false.
    const hasBackendRecord = response.data?.profile || response.data?.onboardingCompleted;
    if (!hasBackendRecord) return;

    const backendProfile = response.data?.profile ?? defaultProfile;
    const nextOnboardingCompleted = response.data?.onboardingCompleted ?? false;

    setErrorMessage(null);
    setProfile(backendProfile);
    setHasCompletedOnboarding(nextOnboardingCompleted);
    await saveStoredProfile(backendProfile, nextOnboardingCompleted);
  }

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
        await refreshSessionFromBackend();
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

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        lastBackgroundedAtRef.current = Date.now();
        return;
      }

      if (nextState !== 'active') {
        return;
      }

      const lastBackgroundedAt = lastBackgroundedAtRef.current;
      const elapsed = lastBackgroundedAt ? Date.now() - lastBackgroundedAt : 0;
      const isStale = elapsed > STALE_THRESHOLD_MS;
      const shouldRestartApp = elapsed > APP_RELAUNCH_RESET_MS;

      if (isStale) {
        setIsReconnecting(true);
      }

      void refreshSessionFromBackend()
        .catch(() => undefined)
        .finally(() => setIsReconnecting(false));

      if (shouldRestartApp) {
        setAppInstanceKey((current) => current + 1);
      }
    });

    return () => subscription.remove();
  }, []);

  // ── React to user identity changes (sign-out / sign-in after sign-out) ───
  useEffect(() => {
    // Skip until auth is fully restored — prevents the null→userId transition
    // from being misread as a post-sign-out sign-in.
    if (isAuthLoading) return;

    const currentUserId = user?.id ?? null;
    const prevUserId = prevUserIdRef.current;
    prevUserIdRef.current = currentUserId;

    // First auth resolution — hydrate() already handles the initial load
    if (prevUserId === undefined) return;
    // No change in identity
    if (currentUserId === prevUserId) return;

    if (!currentUserId) {
      // Signed out: reset to blank state so no data bleeds into the next user
      setProfile(defaultProfile);
      setHasCompletedOnboarding(false);
      setIsHydrated(false);
      setErrorMessage(null);
      return;
    }

    // New user signed in after a sign-out — re-hydrate from backend.
    // Local storage was cleared by auth-context on SIGNED_OUT so this loads
    // a fresh session for the new account.
    void refreshSessionFromBackend()
      .catch(() => undefined)
      .finally(() => setIsHydrated(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAuthLoading]);

  const saveProfile = useCallback(async (nextProfile: Profile, completeOnboarding?: boolean) => {
    const willCompleteOnboarding = completeOnboarding ?? hasCompletedOnboarding;
    setIsSaving(true);
    setErrorMessage(null);
    const response = await profileService.saveProfile({
      profile: nextProfile,
      onboardingCompleted: willCompleteOnboarding,
    });

    if (response.success && response.data) {
      const backendProfile = response.data.profile ?? defaultProfile;
      const nextOnboardingCompleted = response.data.onboardingCompleted;

      setProfile(backendProfile);
      setHasCompletedOnboarding(nextOnboardingCompleted);
      await saveStoredProfile(backendProfile, nextOnboardingCompleted);
      setIsSaving(false);
      return true;
    } else {
      setErrorMessage(response.error?.message ?? 'Failed to save profile.');
    }

    setIsSaving(false);
    return false;
  }, [hasCompletedOnboarding]);

  // Stable context value — only recreated when actual values change, preventing
  // broad consumer re-renders when unrelated session state updates.
  const contextValue = useMemo(() => ({
    appInstanceKey,
    hasCompletedOnboarding,
    isHydrated,
    isReconnecting,
    isSaving,
    profile,
    errorMessage,
    saveProfile,
  }), [appInstanceKey, hasCompletedOnboarding, isHydrated, isReconnecting, isSaving, profile, errorMessage, saveProfile]);

  return (
    <AppSessionContext.Provider value={contextValue}>
      {children}
    </AppSessionContext.Provider>
  );
}
