import { createContext } from 'react';

import type { Profile } from '@/types/profile';

export type AppSessionValue = {
  appInstanceKey: number;
  hasCompletedOnboarding: boolean;
  isHydrated: boolean;
  isReconnecting: boolean;
  isSaving: boolean;
  profile: Profile;
  errorMessage: string | null;
  saveProfile: (profile: Profile, completeOnboarding?: boolean) => Promise<boolean>;
};

export const AppSessionContext = createContext<AppSessionValue | null>(null);
