import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase, type SupabaseProfile } from '@/lib/supabase';
import { clearAllLocalUserData, syncUserDataOnSignIn } from '@/lib/user-data-sync';
import { setAnalyticsUserId } from '@/lib/analytics';
import { setCrashlyticsUserId } from '@/lib/crashlytics';

// Required so the in-app browser session can be dismissed cleanly after OAuth.
WebBrowser.maybeCompleteAuthSession();

// ── Types ──────────────────────────────────────────────────────────────────────

export type AuthResult = { error: string | null };

type AuthContextValue = {
  /** Supabase Auth user. Null when not authenticated or auth is still loading. */
  user: User | null;
  /** Raw Supabase session — contains JWT tokens. */
  session: Session | null;
  /** The public.profiles row for the current user. */
  supabaseProfile: SupabaseProfile | null;
  /** True while the auth session is being restored from storage on app launch. */
  isAuthLoading: boolean;
  signUpWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signInWithApple: () => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  /** Triggers a password-reset email. Always returns success to avoid leaking account existence. */
  sendPasswordResetEmail: (email: string) => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Helpers ────────────────────────────────────────────────────────────────────

async function fetchSupabaseProfile(userId: string): Promise<SupabaseProfile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return data ?? null;
}

// ── Provider ───────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [supabaseProfile, setSupabaseProfile] = useState<SupabaseProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // ── Session hydration on launch ─────────────────────────────────────────────
  useEffect(() => {
    // Restore session from AsyncStorage — this is synchronous relative to the Supabase SDK
    // but async because AsyncStorage.getItem is async.
    void supabase.auth.getSession().then(({ data: { session: stored } }) => {
      setSession(stored);
      setUser(stored?.user ?? null);
      if (stored?.user) {
        setAnalyticsUserId(stored.user.id);
        setCrashlyticsUserId(stored.user.id);
        void fetchSupabaseProfile(stored.user.id).then(setSupabaseProfile);
      }
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
        if (event === 'SIGNED_IN') {
          setAnalyticsUserId(next.user.id);
          setCrashlyticsUserId(next.user.id);
          void syncUserDataOnSignIn(next.user.id).catch(() => undefined);
        }
      } else {
        setSupabaseProfile(null);
        if (event === 'SIGNED_OUT') {
          void clearAllLocalUserData().catch(() => undefined);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Auth actions ────────────────────────────────────────────────────────────

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

  // ── Stable context value ────────────────────────────────────────────────────
  const value = useMemo<AuthContextValue>(
    () => ({
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
    }),
    [
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
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
