export const appConfig = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
  useMockServices: process.env.EXPO_PUBLIC_USE_MOCK_SERVICES !== 'false',
} as const;

export function assertApiBaseUrl() {
  if (!appConfig.apiBaseUrl) {
    throw new Error('Missing EXPO_PUBLIC_API_BASE_URL');
  }

  return appConfig.apiBaseUrl;
}
