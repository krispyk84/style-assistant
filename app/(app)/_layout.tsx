import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandSplash } from '@/components/ui/brand-splash';
import { AppText } from '@/components/ui/app-text';
import { spacing, theme as staticTheme } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { useAppSession } from '@/hooks/use-app-session';

const TAB_ICON_SIZE = 22;

// Icon names for selected/unselected states
const TAB_ICONS = {
  home:     { active: 'home',          inactive: 'home-outline' },
  week:     { active: 'calendar',      inactive: 'calendar-outline' },
  history:  { active: 'body',            inactive: 'body-outline' },
  closet:   { active: 'shirt',         inactive: 'shirt-outline' },
  settings: { active: 'options',       inactive: 'options-outline' },
} as const;

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const { theme } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.lg,
          paddingHorizontal: spacing.lg,
        }}>
        <AppText variant="sectionTitle" style={{ textAlign: 'center' }}>
          Something went wrong
        </AppText>
        <AppText tone="muted" style={{ textAlign: 'center' }} numberOfLines={4}>
          {error.message || 'An unexpected error occurred. Please try again.'}
        </AppText>
        <View
          onTouchEnd={retry}
          style={{
            backgroundColor: theme.colors.text,
            borderRadius: 999,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
          }}>
          <AppText style={{ color: theme.colors.inverseText, fontSize: 14, letterSpacing: 0.8, textTransform: 'uppercase' }}>
            Retry
          </AppText>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function AppTabsLayout() {
  const { hasCompletedOnboarding, isHydrated } = useAppSession();
  const { user } = useAuth();
  const { theme } = useTheme();

  useEffect(() => {
    if (!user) {
      router.replace('/auth');
    }
  }, [user]);

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

  if (!hasCompletedOnboarding || true) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.accent,
          tabBarInactiveTintColor: theme.colors.subtleText,
          tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
            borderTopWidth: 1,
            height: 88,
            paddingBottom: 20,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontFamily: staticTheme.fonts.sansMedium,
            fontSize: 10,
            letterSpacing: 0.3,
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
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                color={color}
                name={focused ? TAB_ICONS.home.active : TAB_ICONS.home.inactive}
                size={TAB_ICON_SIZE}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="week"
          options={{
            title: 'Week',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                color={color}
                name={focused ? TAB_ICONS.week.active : TAB_ICONS.week.inactive}
                size={TAB_ICON_SIZE}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'Looks',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                color={color}
                name={focused ? TAB_ICONS.history.active : TAB_ICONS.history.inactive}
                size={TAB_ICON_SIZE}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="closet"
          options={{
            title: 'Closet',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                color={color}
                name={focused ? TAB_ICONS.closet.active : TAB_ICONS.closet.inactive}
                size={TAB_ICON_SIZE}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                color={color}
                name={focused ? TAB_ICONS.settings.active : TAB_ICONS.settings.inactive}
                size={TAB_ICON_SIZE}
              />
            ),
          }}
        />
        <Tabs.Screen name="profile"             options={{ href: null }} />
        {/* ── Hidden: modularization artifacts — not tabs ──────────────── */}
        <Tabs.Screen name="ClosetScreenView"    options={{ href: null }} />
        <Tabs.Screen name="LooksScreen"         options={{ href: null }} />
        <Tabs.Screen name="SettingsScreen"      options={{ href: null }} />
        <Tabs.Screen name="WeekScreen"          options={{ href: null }} />
        <Tabs.Screen name="useClosetData"       options={{ href: null }} />
        <Tabs.Screen name="useClosetNavigation" options={{ href: null }} />
        <Tabs.Screen name="useClosetAnimations" options={{ href: null }} />
        <Tabs.Screen name="closet-grid-utils"   options={{ href: null }} />
        <Tabs.Screen name="useFavouritesData"   options={{ href: null }} />
        <Tabs.Screen name="useHistoryData"      options={{ href: null }} />
        <Tabs.Screen name="useHistoryActions"   options={{ href: null }} />
        <Tabs.Screen name="useHomeData"         options={{ href: null }} />
        <Tabs.Screen name="useLogout"           options={{ href: null }} />
        <Tabs.Screen name="useSettings"         options={{ href: null }} />
        <Tabs.Screen name="useWeekPlan"         options={{ href: null }} />
        <Tabs.Screen name="useWeekPlanActions"  options={{ href: null }} />
      </Tabs>
    </View>
  );
}
