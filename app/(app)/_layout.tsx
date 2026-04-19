import { Redirect, router, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MoreBottomSheet } from '@/components/more/more-bottom-sheet';
import { AppIcon } from '@/components/ui/app-icon';
import { BrandSplash } from '@/components/ui/brand-splash';
import { AppText } from '@/components/ui/app-text';
import { spacing, theme as staticTheme } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { useAppSession } from '@/hooks/use-app-session';
import { useLogout } from './useLogout';

const TAB_ICON_SIZE = 22;

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
  const { handleLogout } = useLogout();
  const [moreSheetVisible, setMoreSheetVisible] = useState(false);

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

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <View style={{ flex: 1 }}>
      {moreSheetVisible ? (
        <MoreBottomSheet
          onClose={() => setMoreSheetVisible(false)}
          onSignOut={handleLogout}
        />
      ) : null}
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
              <AppIcon name="home" color={color} size={TAB_ICON_SIZE} strokeWidth={focused ? 1.6 : 1.1} />
            ),
          }}
        />
        <Tabs.Screen
          name="week"
          options={{
            title: 'Week',
            tabBarIcon: ({ color, focused }) => (
              <AppIcon name="calendar" color={color} size={TAB_ICON_SIZE} strokeWidth={focused ? 1.6 : 1.1} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'Looks',
            tabBarIcon: ({ color, focused }) => (
              <AppIcon name="clothes-pattern" color={color} size={TAB_ICON_SIZE} strokeWidth={focused ? 1.6 : 1.1} />
            ),
          }}
        />
        <Tabs.Screen
          name="closet"
          options={{
            title: 'Closet',
            tabBarIcon: ({ color, focused }) => (
              <AppIcon name="closet" color={color} size={TAB_ICON_SIZE} strokeWidth={focused ? 1.6 : 1.1} />
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarIcon: ({ color }) => (
              <AppIcon name="nav-menu-vertical" color={color} size={TAB_ICON_SIZE} />
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setMoreSheetVisible(true);
            },
          }}
        />
        <Tabs.Screen name="travel-planner"       options={{ href: null }} />
        <Tabs.Screen name="wardrobe-score"       options={{ href: null }} />
        <Tabs.Screen name="WardrobeScoreScreen"  options={{ href: null }} />
        <Tabs.Screen name="settings"            options={{ href: null }} />
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
