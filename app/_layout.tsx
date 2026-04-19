import { ThemeProvider } from '@react-navigation/native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components/ui/toast-provider';
import { AuthProvider } from '@/contexts/auth-context';
import { AppThemeProvider, useTheme } from '@/contexts/theme-context';
import { buildNavTheme } from '@/constants/themes';
import { AppSessionProvider } from '@/contexts/app-session-provider';
import { useAppSession } from '@/hooks/use-app-session';
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
        <Stack.Screen name="trip-results" options={{ headerShown: false }} />
        <Stack.Screen name="trip-anchors" options={{ headerShown: false }} />
        <Stack.Screen name="packing-list" options={{ headerShown: false }} />
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
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingTop: 48 }}
        onTouchEnd={retry}>
        <Text style={{ color: '#e00', fontSize: 15, fontWeight: '600', marginBottom: 12 }}>
          Something went wrong
        </Text>
        <Text style={{ color: '#333', fontSize: 13, fontWeight: '600', marginBottom: 4 }}>
          {error?.name ?? 'Error'}
        </Text>
        <Text style={{ color: '#666', fontSize: 12, marginBottom: 16 }}>
          {error?.message ?? 'An unexpected error occurred.'}
        </Text>
        <Text style={{ color: '#999', fontSize: 11, fontFamily: 'Courier', lineHeight: 16 }}>
          {error?.stack ?? ''}
        </Text>
        <Text style={{ color: '#aaa', fontSize: 12, marginTop: 24, textAlign: 'center' }}>
          Tap anywhere to retry
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
