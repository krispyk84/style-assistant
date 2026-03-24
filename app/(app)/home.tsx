import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { ImageBackground, Pressable, View } from 'react-native';

import { WeatherCard } from '@/components/cards/weather-card';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { spacing, theme } from '@/constants/theme';
import { useAppSession } from '@/hooks/use-app-session';
import { useCurrentWeather } from '@/hooks/use-current-weather';

// To show a background photo, drop an image file into assets/images/
// and uncomment + point the line below at it:
// const heroImage = require('../../assets/images/home-hero.jpg');
const heroImage: Parameters<typeof ImageBackground>[0]['source'] | null = null;

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const { weather, isLoading, errorMessage } = useCurrentWeather();
  const { profile } = useAppSession();
  const firstName = profile.name.trim() || 'there';

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>

        {/* Brand mark */}
        <View style={{ alignItems: 'center', paddingTop: spacing.sm }}>
          <Ionicons color={theme.colors.text} name="flash" size={22} />
        </View>

        {/* Greeting */}
        <View style={{ gap: spacing.sm }}>
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
          <AppText variant="hero" style={{ color: theme.colors.text }}>
            {getGreeting()},{'\n'}{firstName}.
          </AppText>
          <AppText tone="muted" style={{ lineHeight: 22 }}>
            Your wardrobe is ready for a new perspective.{'\n'}What shall we build today?
          </AppText>
        </View>

        {/* Hero card */}
        <Link href="/(app)/create-look" asChild>
          <Pressable style={{ borderRadius: 24, overflow: 'hidden' }}>
            {heroImage ? (
              <ImageBackground
                source={heroImage}
                style={{ minHeight: 320 }}
                imageStyle={{ borderRadius: 24 }}>
                <HeroCardContent />
              </ImageBackground>
            ) : (
              <View style={{ backgroundColor: '#2A1F14', minHeight: 320 }}>
                <HeroCardContent />
              </View>
            )}
          </Pressable>
        </Link>

        {/* Powered by */}
        <View style={{ alignItems: 'center' }}>
          <AppText
            variant="eyebrow"
            tone="subtle"
            style={{ letterSpacing: 1.6 }}>
            ✦ Powered by Vesture Intelligence ✦
          </AppText>
        </View>

        {/* Weather section */}
        <View style={{ gap: spacing.md }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
            Current Context
          </AppText>
          <WeatherCard
            weather={weather}
            isLoading={isLoading}
            errorMessage={errorMessage}
          />
        </View>

        {/* Footer */}
        <View style={{ alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm }}>
          <View style={{ width: 1, height: 40, backgroundColor: theme.colors.border }} />
          <AppText variant="eyebrow" tone="subtle" style={{ letterSpacing: 2 }}>
            Est. 2024
          </AppText>
        </View>

      </View>
    </AppScreen>
  );
}

function HeroCardContent() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'flex-end',
        padding: spacing.lg,
        gap: spacing.md,
        // Subtle dark gradient at bottom via a semi-transparent overlay
        backgroundColor: 'rgba(18, 12, 6, 0.38)',
        minHeight: 320,
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
            backgroundColor: theme.colors.accent,
            borderRadius: 999,
            height: 48,
            justifyContent: 'center',
            width: 48,
          }}>
          <Ionicons color="#FFFFFF" name="arrow-forward" size={20} />
        </View>
      </View>
    </View>
  );
}
