import { ThemeProvider } from '@react-navigation/native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { ToastProvider } from '@/components/ui/toast-provider';
import { navTheme } from '@/constants/theme';
import { AppSessionProvider, useAppSession } from '@/hooks/use-app-session';

function AppNavigation() {
  const { appInstanceKey } = useAppSession();

  // router is the stable singleton (same pattern used in AppScreen and ScreenHeader).
  // useRouter() subscribes to preview context via use() in React 19, and putting
  // router in the dependency array would re-run this effect on every context change
  // even though router itself never changes. Use the singleton and omit it from deps.
  useEffect(() => {
    if (!appInstanceKey) {
      return;
    }

    router.replace('/');
  }, [appInstanceKey]);

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
        <Stack.Screen name="review-request" options={{ headerShown: false }} />
        <Stack.Screen name="check-piece" options={{ headerShown: false }} />
        <Stack.Screen name="selfie-review" options={{ headerShown: false }} />
        <Stack.Screen name="results/[requestId]" options={{ headerShown: false }} />
        <Stack.Screen name="tier/[tier]" options={{ headerShown: false }} />
        <Stack.Screen name="create-look" options={{ headerShown: false }} />
        <Stack.Screen name="camera-capture" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
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
