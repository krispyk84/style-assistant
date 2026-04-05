import { Stack } from 'expo-router';

import { useTheme } from '@/contexts/theme-context';
import { buildNavTheme } from '@/constants/themes';

export default function AuthLayout() {
  const { theme } = useTheme();
  const navTheme = buildNavTheme(theme);

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
