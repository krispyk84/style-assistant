import { ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { ToastProvider } from '@/components/ui/toast-provider';
import { navTheme } from '@/constants/theme';
import { AppSessionProvider, useAppSession } from '@/hooks/use-app-session';

function AppNavigation() {
  const router = useRouter();
  const { appInstanceKey } = useAppSession();

  useEffect(() => {
    if (!appInstanceKey) {
      return;
    }

    router.replace('/');
  }, [appInstanceKey, router]);

  return (
    <ThemeProvider value={navTheme}>
      <Stack
        key={appInstanceKey}
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
        <Stack.Screen name="onboarding" options={{ title: 'Onboarding', gestureEnabled: false }} />
        <Stack.Screen name="review-request" options={{ title: 'Review Request' }} />
        <Stack.Screen name="check-piece" options={{ title: 'Check Piece' }} />
        <Stack.Screen name="selfie-review" options={{ title: 'Selfie Review' }} />
        <Stack.Screen name="results/[requestId]" options={{ title: 'Result' }} />
        <Stack.Screen name="tier/[tier]" options={{ title: 'Tier' }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppSessionProvider>
      <ToastProvider>
        <AppNavigation />
      </ToastProvider>
    </AppSessionProvider>
  );
}
