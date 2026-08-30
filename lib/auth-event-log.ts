import AsyncStorage from '@react-native-async-storage/async-storage';

// Temporary diagnostic log for the "Favourites empty after sign-in" incident
// — records every auth event useAuthSideEffects sees, with a timestamp, so
// we can see the actual event sequence around a sign-out/sign-in cycle
// (does SIGNED_IN fire at all? does a stray SIGNED_OUT follow it and wipe
// what syncUserDataOnSignIn just wrote?) instead of guessing blind.

const LOG_KEY = 'style-assistant/auth-event-log';
const MAX_ENTRIES = 60;

export type AuthLogEntry = {
  at: string;
  event: string;
  userId: string | null;
};

export async function logAuthEvent(event: string, userId: string | null): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY);
    const entries: AuthLogEntry[] = raw ? JSON.parse(raw) : [];
    entries.push({ at: new Date().toISOString(), event, userId });
    await AsyncStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // Non-fatal — this is a debug aid, never let it affect the real auth flow.
  }
}

export async function getAuthEventLog(): Promise<AuthLogEntry[]> {
  const raw = await AsyncStorage.getItem(LOG_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function clearAuthEventLog(): Promise<void> {
  await AsyncStorage.removeItem(LOG_KEY);
}
