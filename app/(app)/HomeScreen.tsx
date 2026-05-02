import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { WeatherCard } from '@/components/cards/weather-card';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useHomeData } from './useHomeData';

// ── Helpers ────────────────────────────────────────────────────────────────────

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export function HomeScreen() {
  const { weather, weatherLoading, weatherError, profile, currentImageUrl, isResolved } = useHomeData();
  const { theme } = useTheme();
  const firstName = profile.name.trim() || 'there';

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>

        {/* Greeting */}
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View
              style={{
                alignSelf: 'flex-start',
                borderColor: theme.colors.accent,
                borderRadius: 999,
                borderWidth: 1,
                paddingHorizontal: spacing.sm,
                paddingVertical: 3,
              }}>
              <AppText
                variant="eyebrow"
                style={{ color: theme.colors.accent, letterSpacing: 0.6 }}>
                The Atelier
              </AppText>
            </View>
            <Pressable
              accessibilityLabel="View and edit your profile"
              onPress={() => router.push('/profile')}
              style={{
                alignItems: 'center',
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: 999,
                borderWidth: 1,
                height: 36,
                justifyContent: 'center',
                width: 36,
              }}>
              <AppIcon color={theme.colors.text} name="person" size={16} />
            </Pressable>
          </View>
          <AppText variant="hero" style={{ color: theme.colors.text }}>
            {getGreeting()},{'\n'}{firstName}.
          </AppText>
          <AppText tone="muted" style={{ lineHeight: 22 }}>
            Your wardrobe is ready for a new perspective.{'\n'}What shall we build today?
          </AppText>
        </View>

        {/* Hero card */}
        <Pressable
          onPress={() => router.push({ pathname: '/create-look', params: { fresh: String(Date.now()) } })}
          style={{ borderRadius: 24, overflow: 'hidden' }}>
          <View style={{ minHeight: 320 }}>
            {/* Dark base */}
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#2A1F14' }]} />

            {/* Default placeholder — shown only after we've confirmed there are no
                saved looks. Hidden during the initial async resolution so the card
                never flashes the default before swapping to a saved-look image. */}
            {isResolved && !currentImageUrl && (
              <Image
                contentFit="cover"
                source={
                  profile.gender === 'woman'
                    ? require('../../assets/images/defaultoutfit-female.jpg')
                    : require('../../assets/images/defaultoutfit.png')
                }
                style={StyleSheet.absoluteFillObject}
              />
            )}

            {/* Carousel image — already prefetched when isResolved=true, so no fade needed */}
            {isResolved && currentImageUrl ? (
              <Image
                contentFit="cover"
                source={{ uri: currentImageUrl }}
                style={StyleSheet.absoluteFillObject}
              />
            ) : null}

            {/* Dark gradient overlay for readability */}
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(18, 12, 6, 0.40)' }]} />

            {/* Content */}
            <HeroCardContent accentColor={theme.colors.accent} />
          </View>
        </Pressable>

        {/* Weather section */}
        <View style={{ gap: spacing.md }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
            Current Context
          </AppText>
          <WeatherCard
            weather={weather}
            isLoading={weatherLoading}
            errorMessage={weatherError}
          />
        </View>

        {/* Footer */}
        <View style={{ alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm }}>
          <View style={{ width: 1, height: 40, backgroundColor: theme.colors.border }} />
          <AppText variant="eyebrow" tone="subtle" style={{ letterSpacing: 2 }}>
            Est. 2026
          </AppText>
        </View>

      </View>
    </AppScreen>
  );
}

// ── Private components ─────────────────────────────────────────────────────────

function HeroCardContent({ accentColor }: { accentColor: string }) {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'flex-end',
        minHeight: 320,
        padding: spacing.lg,
        gap: spacing.md,
      }}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="eyebrow" style={{ color: 'rgba(255,255,255,0.7)', letterSpacing: 2 }}>
          Start your journey
        </AppText>
        <AppText variant="hero" style={{ color: '#FFFFFF' }}>
          Create a{'\n'}New Look
        </AppText>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}>
        <AppText
          style={{
            color: 'rgba(255,255,255,0.72)',
            fontSize: 14,
            lineHeight: 20,
            maxWidth: '65%',
          }}>
          Define your vibe and let our digital atelier curate your perfect ensemble.
        </AppText>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: accentColor,
            borderRadius: 999,
            height: 48,
            justifyContent: 'center',
            width: 48,
          }}>
          <AppIcon color="#FFFFFF" name="arrow-right" size={20} />
        </View>
      </View>
    </View>
  );
}
