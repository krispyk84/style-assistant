export const appConfig = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
  useMockServices: process.env.EXPO_PUBLIC_USE_MOCK_SERVICES !== 'false',
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  // Register a free account at geonames.org and set this env var.
  // The 'demo' fallback is heavily rate-limited — only for local dev.
  geonamesUsername: process.env.EXPO_PUBLIC_GEONAMES_USERNAME ?? 'demo',
} as const;

export function assertApiBaseUrl() {
  if (!appConfig.apiBaseUrl) {
    throw new Error('Missing EXPO_PUBLIC_API_BASE_URL');
  }

  return appConfig.apiBaseUrl;
}

export function assertSupabaseConfig() {
  if (!appConfig.supabaseUrl || !appConfig.supabaseAnonKey) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }

  return { url: appConfig.supabaseUrl, anonKey: appConfig.supabaseAnonKey };
}
