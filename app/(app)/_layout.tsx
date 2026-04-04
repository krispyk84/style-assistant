import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandSplash } from '@/components/ui/brand-splash';
import { AppText } from '@/components/ui/app-text';
import { spacing, theme } from '@/constants/theme';
import { useAppSession } from '@/hooks/use-app-session';

// Catches render exceptions inside any tab screen and shows a recoverable fallback
// instead of a blank screen. Uses only primitive RN components so it cannot itself fail.
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
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
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: theme.fonts.sansMedium,
            fontSize: 16,
            textAlign: 'center',
          }}>
          Something went wrong
        </Text>
        <Text
          style={{
            color: theme.colors.mutedText,
            fontFamily: theme.fonts.sans,
            fontSize: 14,
            textAlign: 'center',
          }}
          numberOfLines={4}>
          {error.message || 'An unexpected error occurred. Please try again.'}
        </Text>
        <Pressable
          onPress={retry}
          style={{
            backgroundColor: theme.colors.text,
            borderRadius: 999,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
          }}>
          <Text
            style={{
              color: theme.colors.background,
              fontFamily: theme.fonts.sansMedium,
              fontSize: 14,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}>
            Retry
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const TAB_ICON_SIZE = 22;

export default function AppTabsLayout() {
  const { hasCompletedOnboarding, isHydrated, isReconnecting } = useAppSession();

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
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'fade',
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
        name="week"
        options={{
          title: 'Week',
          tabBarIcon: ({ color }) => <Ionicons color={color} name="calendar-outline" size={TAB_ICON_SIZE} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Favorites',
          tabBarIcon: ({ color }) => <Ionicons color={color} name="heart-outline" size={TAB_ICON_SIZE} />,
        }}
      />
      <Tabs.Screen
        name="closet"
        options={{
          title: 'Closet',
          tabBarIcon: ({ color }) => <Ionicons color={color} name="shirt-outline" size={TAB_ICON_SIZE} />,
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
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
    {isReconnecting ? (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: theme.colors.background,
          bottom: 0,
          gap: 16,
          justifyContent: 'center',
          left: 0,
          position: 'absolute',
          right: 0,
          top: 0,
        }}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
        <AppText tone="muted" style={{ fontSize: 14 }}>Reconnecting to Vesture...</AppText>
      </View>
    ) : null}
    </View>
  );
}
