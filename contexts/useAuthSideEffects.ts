import { useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';

import { setApiAuthToken } from '@/lib/api/api-client';
import { clearAllLocalUserData, syncUserDataOnSignIn } from '@/lib/user-data-sync';
import { setAnalyticsUserId } from '@/lib/analytics';
import { setCrashlyticsUserId } from '@/lib/crashlytics';

// Synthetic event emitted by useSupabaseAuth during getSession() hydration.
// Supabase's onAuthStateChange does not fire for the restored session on launch,
// so we need a distinct event name to trigger the same ID-setting side effects.
export const AUTH_EVENT_HYDRATED = 'HYDRATED' as const;

export type AuthEventCallback = (event: string, session: Session | null) => void;

/**
 * Returns a stable callback that fires all auth-driven side effects.
 * Called by useSupabaseAuth from within getSession() and onAuthStateChange —
 * both fire synchronously in the same execution context as the state updates,
 * preserving the original effect order.
 *
 * Effect matrix:
 *   setApiAuthToken        — every event (token sync + sign-out clear)
 *   setAnalyticsUserId     — HYDRATED and SIGNED_IN only
 *   setCrashlyticsUserId   — HYDRATED and SIGNED_IN only
 *   syncUserDataOnSignIn   — SIGNED_IN only (not on hydration)
 *   clearAllLocalUserData  — SIGNED_OUT only
 */
export function useAuthSideEffects(): AuthEventCallback {
  return useCallback((event: string, session: Session | null) => {
    // Keep the API client bearer token in sync with the current session.
    // Covers sign-in, sign-out, and automatic token refreshes.
    setApiAuthToken(session?.access_token ?? null);

    if (session?.user) {
      if (event === AUTH_EVENT_HYDRATED || event === 'SIGNED_IN') {
        setAnalyticsUserId(session.user.id);
        setCrashlyticsUserId(session.user.id);
      }
      if (event === 'SIGNED_IN') {
        void syncUserDataOnSignIn(session.user.id).catch(() => undefined);
      }
    } else {
      if (event === 'SIGNED_OUT') {
        void clearAllLocalUserData().catch(() => undefined);
      }
    }
  }, []);
}
