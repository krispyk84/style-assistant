import { router, Stack } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { buildNavTheme } from '@/constants/themes';

export default function AuthLayout() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navTheme = buildNavTheme(theme);

  // When auth state changes to authenticated, go back to the root
  // which will redirect to /(app)/home or /onboarding as appropriate.
  useEffect(() => {
    if (user) {
      router.replace('/');
    }
  }, [user]);

  return (
    <Stack
      screenOptions={{
        animation: 'fade',
        headerShown: false,
        contentStyle: { backgroundColor: navTheme.colors.background },
      }}
    />
  );
}
