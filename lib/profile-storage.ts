import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PersistedSession, Profile } from '@/types/profile';

const STORAGE_KEY = 'style-assistant/session';

const emptySession: PersistedSession = {
  onboardingCompleted: false,
  profile: null,
};

export async function loadSession(): Promise<PersistedSession> {
  const rawValue = await AsyncStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return emptySession;
  }

  try {
    return JSON.parse(rawValue) as PersistedSession;
  } catch {
    return emptySession;
  }
}

export async function saveProfile(profile: Profile, onboardingCompleted: boolean) {
  const nextSession: PersistedSession = {
    onboardingCompleted,
    profile,
  };

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
  return nextSession;
}

export async function clearSession() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
