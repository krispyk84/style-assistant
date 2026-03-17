import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';

import { BrandSplash } from '@/components/ui/brand-splash';
import { theme } from '@/constants/theme';
import { useAppSession } from '@/hooks/use-app-session';

const TAB_ICON_SIZE = 22;

export default function AppTabsLayout() {
  const { hasCompletedOnboarding, isHydrated } = useAppSession();

  if (!isHydrated) {
    return (
      <BrandSplash
        messages={[
          'Loading your Vesture workspace.',
          'Checking your saved profile.',
          'Preparing your styling tools.',
        ]}
      />
    );
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.text,
        tabBarInactiveTintColor: theme.colors.mutedText,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 88,
          paddingBottom: 20,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontFamily: theme.fonts.sansMedium,
          fontSize: 11,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        },
        sceneStyle: {
          backgroundColor: theme.colors.background,
        },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Ionicons color={color} name="home-outline" size={TAB_ICON_SIZE} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Ionicons color={color} name="person-outline" size={TAB_ICON_SIZE} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <Ionicons color={color} name="time-outline" size={TAB_ICON_SIZE} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Ionicons color={color} name="options-outline" size={TAB_ICON_SIZE} />,
        }}
      />
      <Tabs.Screen
        name="create-look"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
