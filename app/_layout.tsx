import { ThemeProvider } from '@react-navigation/native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { ToastProvider } from '@/components/ui/toast-provider';
import { AuthProvider } from '@/contexts/auth-context';
import { AppThemeProvider, useTheme } from '@/contexts/theme-context';
import { buildNavTheme } from '@/constants/themes';
import { AppSessionProvider, useAppSession } from '@/hooks/use-app-session';

function AppNavigation() {
  const { appInstanceKey } = useAppSession();
  const { theme } = useTheme();
  const navTheme = buildNavTheme(theme);

  useEffect(() => {
    if (!appInstanceKey) {
      return;
    }

    router.replace('/');
  }, [appInstanceKey]);

  return (
    <ThemeProvider value={navTheme}>
      <Stack
        screenOptions={{
          animation: 'fade',
          contentStyle: { backgroundColor: navTheme.colors.background },
          headerBackButtonDisplayMode: 'minimal',
          headerTitleAlign: 'center',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: navTheme.colors.background },
          headerTintColor: navTheme.colors.text,
          headerTitleStyle: {
            fontFamily: 'AvenirNext-DemiBold',
            fontSize: 16,
          },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ title: 'Onboarding', gestureEnabled: false }} />
        <Stack.Screen name="review-request" options={{ headerShown: false }} />
        <Stack.Screen name="check-piece" options={{ headerShown: false }} />
        <Stack.Screen name="selfie-review" options={{ headerShown: false }} />
        <Stack.Screen name="results/[requestId]" options={{ headerShown: false }} />
        <Stack.Screen name="tier/[tier]" options={{ headerShown: false }} />
        <Stack.Screen name="create-look" options={{ headerShown: false }} />
        <Stack.Screen name="camera-capture" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return null; // handled by app/(app)/_layout.tsx
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <AuthProvider>
        <AppSessionProvider>
          <ToastProvider>
            <AppNavigation />
          </ToastProvider>
        </AppSessionProvider>
      </AuthProvider>
    </AppThemeProvider>
  );
}
