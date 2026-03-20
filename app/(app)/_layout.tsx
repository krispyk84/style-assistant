import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';

import { BrandSplash } from '@/components/ui/brand-splash';
import { theme } from '@/constants/theme';
import { useAppSession } from '@/hooks/use-app-session';

const TAB_ICON_SIZE = 24;

type TabIconProps = {
  name: keyof typeof Ionicons.glyphMap;
  filledName: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
};

function TabIcon({ name, filledName, color, focused }: TabIconProps) {
  return (
    <View 
      style={{ 
        alignItems: 'center', 
        justifyContent: 'center',
        width: 48,
        height: 32,
        borderRadius: theme.radius.full,
        backgroundColor: focused ? theme.colors.accentLight : 'transparent',
      }}>
      <Ionicons 
        color={focused ? theme.colors.accent : color} 
        name={focused ? filledName : name} 
        size={TAB_ICON_SIZE} 
      />
    </View>
  );
}

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
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.subtleText,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.borderSubtle,
          borderTopWidth: 1,
          height: 90,
          paddingBottom: 24,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontFamily: theme.fonts.sansMedium,
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.5,
          marginTop: 4,
        },
        sceneStyle: {
          backgroundColor: theme.colors.background,
        },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home-outline" filledName="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="week"
        options={{
          title: 'Week',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="calendar-outline" filledName="calendar" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Favorites',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="heart-outline" filledName="heart" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="options-outline" filledName="options" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="create-look"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
