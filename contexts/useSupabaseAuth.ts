import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase, type SupabaseProfile } from '@/lib/supabase';
import { AUTH_EVENT_HYDRATED, type AuthEventCallback } from './useAuthSideEffects';

export type AuthResult = { error: string | null };

async function fetchSupabaseProfile(userId: string): Promise<SupabaseProfile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return data ?? null;
}

type UseSupabaseAuthReturn = {
  user: User | null;
  session: Session | null;
  supabaseProfile: SupabaseProfile | null;
  isAuthLoading: boolean;
  signUpWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signInWithApple: () => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<AuthResult>;
};

export function useSupabaseAuth(onAuthEvent: AuthEventCallback): UseSupabaseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [supabaseProfile, setSupabaseProfile] = useState<SupabaseProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Keep the callback ref in sync every render so the effect closure is never stale.
  const onAuthEventRef = useRef(onAuthEvent);
  onAuthEventRef.current = onAuthEvent;

  // ── Session hydration and ongoing listener ────────────────────────────────
  useEffect(() => {
    // Restore session from AsyncStorage on app launch.
    void supabase.auth.getSession().then(({ data: { session: stored } }) => {
      setSession(stored);
      setUser(stored?.user ?? null);
      if (stored?.user) {
        void fetchSupabaseProfile(stored.user.id).then(setSupabaseProfile);
      }
      // Fire side effects synchronously before marking auth as loaded,
      // preserving the original order: token sync + analytics ID fire first.
      onAuthEventRef.current(AUTH_EVENT_HYDRATED, stored);
      setIsAuthLoading(false);
    });

    // Listen to all subsequent auth changes (sign-in, sign-out, token refresh, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setUser(next?.user ?? null);
      if (next?.user) {
        void fetchSupabaseProfile(next.user.id).then(setSupabaseProfile);
      } else {
        setSupabaseProfile(null);
      }
      onAuthEventRef.current(event, next);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Auth actions ──────────────────────────────────────────────────────────

  const signUpWithEmail = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signInWithApple = useCallback(async (): Promise<AuthResult> => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        return { error: 'Apple sign-in failed. Please try again.' };
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      return { error: error?.message ?? null };
    } catch (err: unknown) {
      // ERR_REQUEST_CANCELED means the user dismissed the sheet — not an error.
      if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
        return { error: null };
      }
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Apple sign-in error]', err);
      return { error: `Apple sign-in failed: ${message}` };
    }
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    try {
      const redirectUrl = Linking.createURL('auth/callback');

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (oauthError || !data.url) {
        return { error: oauthError?.message ?? 'Google sign-in failed.' };
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (result.type !== 'success') {
        // User cancelled or browser was dismissed — not an error state.
        return { error: null };
      }

      // Supabase implicit flow: tokens come back in the URL hash fragment.
      // e.g. styleassistant://auth/callback#access_token=...&refresh_token=...
      const hashIndex = result.url.indexOf('#');
      const fragment = hashIndex !== -1 ? result.url.slice(hashIndex + 1) : '';
      const params = new URLSearchParams(fragment);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (!accessToken || !refreshToken) {
        return { error: 'Google sign-in failed: no session tokens received.' };
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      return { error: sessionError?.message ?? null };
    } catch {
      return { error: 'Google sign-in failed. Please try again.' };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSupabaseProfile(null);
  }, []);

  const sendPasswordResetEmail = useCallback(async (email: string): Promise<AuthResult> => {
    const redirectUrl = Linking.createURL('auth/reset-password');
    // We intentionally ignore whether the email exists to avoid leaking account information.
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
    return { error: null };
  }, []);

  return {
    user,
    session,
    supabaseProfile,
    isAuthLoading,
    signUpWithEmail,
    signInWithEmail,
    signInWithApple,
    signInWithGoogle,
    signOut,
    sendPasswordResetEmail,
  };
}
