import { ThemeProvider } from '@react-navigation/native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components/ui/toast-provider';
import { AuthProvider } from '@/contexts/auth-context';
import { AppThemeProvider, useTheme } from '@/contexts/theme-context';
import { buildNavTheme } from '@/constants/themes';
import { AppSessionProvider, useAppSession } from '@/hooks/use-app-session';
import { ScreenTracker } from '@/lib/analytics';

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
      <ScreenTracker />
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
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
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
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#e00' }}>
          Root Error
        </Text>
        <Text style={{ fontSize: 13, color: '#333', marginBottom: 16 }}>
          {error?.message ?? String(error)}
        </Text>
        <Text style={{ fontSize: 11, color: '#888' }}>
          {error?.stack ?? '(no stack)'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
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
