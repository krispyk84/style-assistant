import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import type { Session, User } from '@supabase/supabase-js';

// Required so the in-app browser session can be dismissed cleanly after OAuth.
import * as WebBrowser from 'expo-web-browser';
WebBrowser.maybeCompleteAuthSession();

import type { SupabaseProfile } from '@/lib/supabase';
import { useSupabaseAuth } from './useSupabaseAuth';
import { useAuthSideEffects } from './useAuthSideEffects';

export type { AuthResult } from './useSupabaseAuth';

// ── Types ──────────────────────────────────────────────────────────────────────

type AuthContextValue = {
  /** Supabase Auth user. Null when not authenticated or auth is still loading. */
  user: User | null;
  /** Raw Supabase session — contains JWT tokens. */
  session: Session | null;
  /** The public.profiles row for the current user. */
  supabaseProfile: SupabaseProfile | null;
  /** True while the auth session is being restored from storage on app launch. */
  isAuthLoading: boolean;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  /** Triggers a password-reset email. Always returns success to avoid leaking account existence. */
  sendPasswordResetEmail: (email: string) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: PropsWithChildren) {
  // useAuthSideEffects must be called first — useSupabaseAuth invokes the
  // returned callback during its own effect (including getSession hydration),
  // so the callback must be ready before that effect fires.
  const handleAuthEvent = useAuthSideEffects();
  const {
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
  } = useSupabaseAuth(handleAuthEvent);

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
