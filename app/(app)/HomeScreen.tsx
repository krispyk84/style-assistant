import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { GenerateOutfitsModal } from '@/components/closet/GenerateOutfitsModal';
import { useGenerateOutfits } from '@/components/closet/useGenerateOutfits';
import { WeatherCard } from '@/components/cards/weather-card';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { ClosetReadiness } from '@/lib/closet-readiness';
import { useHomeData } from './useHomeData';

// ── Screen ─────────────────────────────────────────────────────────────────────

export function HomeScreen() {
  const {
    weather, weatherLoading, weatherError, profile, currentImageUrl, isResolved, closetReadiness,
    closetCurrentImageUrl, isClosetCarouselResolved,
  } = useHomeData();
  const { theme } = useTheme();
  const generateOutfits = useGenerateOutfits();

  return (
    <AppScreen scrollable bounces={false}>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>

        {/* Header */}
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
              Vesture
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
            <HeroCardContent accentColor={theme.colors.accent} inverseColor={theme.colors.inverseText} />
          </View>
        </Pressable>

        {/* Generate from closet */}
        {closetReadiness ? (
          <GenerateFromClosetButton
            readiness={closetReadiness}
            onPress={generateOutfits.open}
            currentImageUrl={closetCurrentImageUrl}
            isResolved={isClosetCarouselResolved}
            accentColor={theme.colors.accent}
            inverseColor={theme.colors.inverseText}
          />
        ) : null}
        <GenerateOutfitsModal hook={generateOutfits} />

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

function GenerateFromClosetButton({
  readiness,
  onPress,
  currentImageUrl,
  isResolved,
  accentColor,
  inverseColor,
}: {
  readiness: ClosetReadiness;
  onPress: () => void;
  currentImageUrl: string | null;
  isResolved: boolean;
  accentColor: string;
  inverseColor: string;
}) {
  const { theme } = useTheme();

  if (!readiness.ready) {
    return (
      <View
        style={{
          backgroundColor: theme.colors.subtleSurface,
          borderColor: theme.colors.border,
          borderRadius: 20,
          borderWidth: 1,
          gap: spacing.xs,
          padding: spacing.lg,
        }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
          <AppIcon color={theme.colors.subtleText} name="closet" size={18} />
          <AppText tone="subtle" style={{ fontFamily: theme.fonts.sansMedium, fontSize: 15 }}>
            Please add more items to your closet so that we can generate good outfits for you.
          </AppText>
        </View>
        <AppText tone="subtle" style={{ fontSize: 12, lineHeight: 17 }}>
          You need a good collection of a variety of pieces — this app is missing {joinWithAnd(readiness.missing)} before it can start generating outfits.
        </AppText>
      </View>
    );
  }

  // Mirrors the "Create a New Look" hero card above — same size, same dark
  // base + gradient-over-photo treatment, same carousel behavior (shuffled
  // order, prefetch-then-swap, CAROUSEL_INTERVAL_MS cadence) — just sourced
  // from closet item photos instead of saved-outfit sketches.
  return (
    <Pressable onPress={onPress} style={{ borderRadius: 24, overflow: 'hidden' }}>
      <View style={{ minHeight: 320 }}>
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#2A1F14' }]} />

        {isResolved && currentImageUrl ? (
          <Image
            contentFit="cover"
            source={{ uri: currentImageUrl }}
            style={StyleSheet.absoluteFillObject}
          />
        ) : null}

        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(18, 12, 6, 0.40)' }]} />

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
              From your wardrobe
            </AppText>
            <AppText variant="hero" style={{ color: '#FFFFFF' }}>
              Create Outfits{'\n'}From My Closet
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <AppText style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14, lineHeight: 20, maxWidth: '65%' }}>
              Five complete looks, built entirely from what you already own.
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
              <AppIcon color={inverseColor} name="arrow-right" size={20} />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function HeroCardContent({ accentColor, inverseColor }: { accentColor: string; inverseColor: string }) {
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
          <AppIcon color={inverseColor} name="arrow-right" size={20} />
        </View>
      </View>
    </View>
  );
}
