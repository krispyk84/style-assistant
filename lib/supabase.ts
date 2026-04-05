import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { appConfig } from '@/constants/config';

/**
 * Supabase client — single instance for the entire app.
 *
 * Session is persisted via AsyncStorage so it survives app restarts.
 * autoRefreshToken keeps the JWT fresh in the background.
 * detectSessionInUrl must be false for React Native (no URL bar).
 */
export const supabase = createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Row shape for the public.profiles table.
 * id is the Supabase auth user id (uuid).
 */
export type SupabaseProfile = {
  id: string;
  created_at: string;
  auth_provider: string | null;
  onboarding_complete: boolean;
};
