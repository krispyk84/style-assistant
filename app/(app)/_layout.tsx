import { Redirect, router, Tabs } from 'expo-router';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, Easing, Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { MoreBottomSheet } from '@/components/more/more-bottom-sheet';
import { AppIcon } from '@/components/ui/app-icon';
import { BrandSplash } from '@/components/ui/brand-splash';
import { AppText } from '@/components/ui/app-text';
import { HOME_HEADER_LOGO_RECT_CONSTANTS } from '@/app/(app)/home-header-logo-constants';
import { spacing, theme as staticTheme } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { useAppSession } from '@/hooks/use-app-session';
import { homeReadiness } from '@/lib/home-readiness';
import { splashShrinkOverlay } from '@/lib/splash-shrink-overlay';
import { useLogout } from './useLogout';

// Upper bound on how long the splash overlay waits for Home's own data
// (weather, hero + closet image carousels) before giving up — a stuck
// network shouldn't be able to trap the user on the splash screen forever.
const HOME_READY_TIMEOUT_MS = 8000;
const SPLASH_FADE_OUT_MS = 900;
// The splash logo's own box: BrandSplash centers it (height 220, capped at
// maxWidth 220) in the middle of the screen.
const SPLASH_LOGO_SIZE = 220;
const SPLASH_LOGO_HORIZONTAL_PADDING = spacing.xl;

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

const SPLASH_MESSAGES = [
  'Loading your Vesture workspace.',
  'Checking your saved profile.',
  'Preparing your styling tools.',
];

export default function AppTabsLayout() {
  const { hasCompletedOnboarding, isHydrated } = useAppSession();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { handleLogout } = useLogout();
  const [moreSheetVisible, setMoreSheetVisible] = useState(false);
  const isHomeReady = useSyncExternalStore(homeReadiness.subscribe, homeReadiness.getSnapshot);
  const [homeReadyTimedOut, setHomeReadyTimedOut] = useState(false);
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // Kept mounted slightly past showSplashOverlay flipping false so the fade-out
  // animation below has time to actually play — an instant unmount would make
  // the splash disappear abruptly regardless of the opacity animation.
  const [isSplashMounted, setIsSplashMounted] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;
  // Drives the splash logo shrinking into Home's actual logo position on
  // fade-out (0 = splash rect, 1 = Home header logo rect). Layout properties
  // (not transform) so each box's own resizeMode:'contain' correctly refits
  // the (non-square) logo artwork as the box's aspect ratio changes — a pure
  // transform-scale would stretch it unevenly instead.
  const shrinkProgress = useRef(new Animated.Value(0)).current;

  // Both endpoints computed analytically (not measured at runtime) so the
  // landing spot always exactly matches HomeScreen's actual header layout by
  // construction — a cross-component runtime measurement here previously
  // landed the animation in the wrong place.
  const splashLogoSize = Math.min(SPLASH_LOGO_SIZE, windowWidth - SPLASH_LOGO_HORIZONTAL_PADDING * 2);
  const splashLogoRect = {
    x: (windowWidth - splashLogoSize) / 2,
    y: (windowHeight - splashLogoSize) / 2,
    width: splashLogoSize,
    height: splashLogoSize,
  };
  const homeLogoRect = {
    x: (windowWidth - HOME_HEADER_LOGO_RECT_CONSTANTS.width) / 2,
    y: insets.top + HOME_HEADER_LOGO_RECT_CONSTANTS.topPadding
      + (HOME_HEADER_LOGO_RECT_CONSTANTS.rowHeight - HOME_HEADER_LOGO_RECT_CONSTANTS.height) / 2,
    width: HOME_HEADER_LOGO_RECT_CONSTANTS.width,
    height: HOME_HEADER_LOGO_RECT_CONSTANTS.height,
  };

  useEffect(() => {
    if (!user) {
      router.replace('/auth');
    }
  }, [user]);

  // Starts counting only once we actually begin waiting on Home, so a slow
  // session hydration doesn't eat into this budget.
  useEffect(() => {
    if (!isHydrated || isHomeReady) return;
    const timeout = setTimeout(() => setHomeReadyTimedOut(true), HOME_READY_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [isHydrated, isHomeReady]);

  const showSplashOverlay = isHydrated && !isHomeReady && !homeReadyTimedOut;
  const isShrinkingIntoHome = !showSplashOverlay;

  // Home's own header logo stays hidden for as long as this overlay is on
  // screen animating toward it — otherwise both are visible at once.
  useEffect(() => {
    splashShrinkOverlay.setActive(isSplashMounted && isShrinkingIntoHome);
  }, [isSplashMounted, isShrinkingIntoHome]);

  useEffect(() => {
    if (showSplashOverlay) {
      // Home became not-ready again (shouldn't normally happen once shown) — snap back visible.
      splashOpacity.setValue(1);
      shrinkProgress.setValue(0);
      setIsSplashMounted(true);
      return;
    }
    if (!isSplashMounted) return;
    Animated.parallel([
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: SPLASH_FADE_OUT_MS,
        useNativeDriver: true,
      }),
      Animated.timing(shrinkProgress, {
        toValue: 1,
        duration: SPLASH_FADE_OUT_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(({ finished }) => {
      if (finished) setIsSplashMounted(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSplashOverlay]);

  if (!isHydrated) {
    return <BrandSplash messages={SPLASH_MESSAGES} />;
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  // Tabs (and Home inside it) mount and start loading immediately below —
  // the splash just visually covers that work as an overlay until Home
  // reports it's fully ready (or the safety timeout fires), rather than
  // blocking the mount itself.

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
        <Tabs.Screen name="TripAnchorsScreen"    options={{ href: null }} />
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
        <Tabs.Screen name="useFashionTrendReport" options={{ href: null }} />
        <Tabs.Screen name="useHomeData"         options={{ href: null }} />
        <Tabs.Screen name="home-header-logo-constants" options={{ href: null }} />
        <Tabs.Screen name="useLogout"           options={{ href: null }} />
        <Tabs.Screen name="useSettings"         options={{ href: null }} />
        <Tabs.Screen name="useWeekPlan"         options={{ href: null }} />
        <Tabs.Screen name="useWeekPlanActions"  options={{ href: null }} />
        {/* ── Hidden: session refactor artifacts ──────────────────────── */}
        <Tabs.Screen name="HomeScreen"                options={{ href: null }} />
        <Tabs.Screen name="LooksFavouritesTab"        options={{ href: null }} />
        <Tabs.Screen name="LooksFilterPills"          options={{ href: null }} />
        <Tabs.Screen name="LooksHistoryTab"           options={{ href: null }} />
        <Tabs.Screen name="TravelPlannerScreen"       options={{ href: null }} />
        <Tabs.Screen name="TravelPlannerNewTripForm"  options={{ href: null }} />
        <Tabs.Screen name="TravelPlannerSavedTab"     options={{ href: null }} />
        <Tabs.Screen name="travel-planner-primitives" options={{ href: null }} />
        <Tabs.Screen name="travel-planner-types"      options={{ href: null }} />
        <Tabs.Screen name="travel-planner-mappers"    options={{ href: null }} />
        <Tabs.Screen name="useTravelPlannerForm"      options={{ href: null }} />
        <Tabs.Screen name="useSavedTripsData"         options={{ href: null }} />
      </Tabs>

      {isSplashMounted ? (
        <Animated.View
          pointerEvents={showSplashOverlay ? 'auto' : 'none'}
          style={[StyleSheet.absoluteFillObject, { opacity: splashOpacity }]}>
          <BrandSplash messages={SPLASH_MESSAGES} hideLogo={isShrinkingIntoHome} />
        </Animated.View>
      ) : null}

      {isSplashMounted && isShrinkingIntoHome ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: shrinkProgress.interpolate({ inputRange: [0, 1], outputRange: [splashLogoRect.x, homeLogoRect.x] }),
            top: shrinkProgress.interpolate({ inputRange: [0, 1], outputRange: [splashLogoRect.y, homeLogoRect.y] }),
            width: shrinkProgress.interpolate({ inputRange: [0, 1], outputRange: [splashLogoRect.width, homeLogoRect.width] }),
            height: shrinkProgress.interpolate({ inputRange: [0, 1], outputRange: [splashLogoRect.height, homeLogoRect.height] }),
          }}>
          <Image fadeDuration={0} source={require('../../logo.png')} style={{ height: '100%', resizeMode: 'contain', width: '100%' }} />
        </Animated.View>
      ) : null}
    </View>
  );
}
