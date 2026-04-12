import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PersistedSession, Profile } from '@/types/profile';

const STORAGE_KEY = 'style-assistant/session';

const emptySession: PersistedSession = {
  onboardingCompleted: false,
  profile: null,
};

function normalizeSession(raw: PersistedSession): PersistedSession {
  if (!raw.profile) {
    return raw;
  }

  return {
    ...raw,
    profile: {
      ...raw.profile,
      // Migrate profiles stored before 'name' was added
      name: raw.profile.name ?? '',
      // bodyType is optional — undefined for women and users who haven't re-onboarded
      bodyType: raw.profile.bodyType ?? undefined,
      fitTendency: raw.profile.fitTendency ?? undefined,
    },
  };
}

export async function loadSession(): Promise<PersistedSession> {
  const rawValue = await AsyncStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return emptySession;
  }

  try {
    return normalizeSession(JSON.parse(rawValue) as PersistedSession);
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
