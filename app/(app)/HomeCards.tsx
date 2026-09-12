import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { ClosetReadinessTracker, joinWithAnd } from '@/components/closet/ClosetReadinessTracker';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { ClosetReadiness } from '@/lib/closet-readiness';

// ── Home's two entry cards ───────────────────────────────────────────────────
//
// Split out of HomeScreen.tsx so these — the exact copy shown to users for
// Vesture's two outfit-generation flows ("Build Around a Piece" / "Build
// From My Closet") — can be unit-tested without also pulling in HomeScreen's
// heavier surrounding machinery (static image requires, carousel data
// loading, splash-overlay sync).

export function GenerateFromClosetButton({
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
          gap: spacing.md,
          padding: spacing.lg,
        }}>
        <View style={{ gap: spacing.xs }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
            <AppIcon color={theme.colors.subtleText} name="closet" size={18} />
            <AppText tone="subtle" style={{ fontFamily: theme.fonts.sansMedium, fontSize: 15 }}>
              Build From My Closet needs a wider variety first
            </AppText>
          </View>
          <AppText tone="subtle" style={{ fontSize: 12, lineHeight: 17 }}>
            Unlike Build Around a Piece above — which can suggest new pieces too — this builds looks entirely from what&apos;s already in
            your closet, so it needs enough to mix and match. You&apos;re missing {joinWithAnd(readiness.missing)}.
          </AppText>
        </View>
        <ClosetReadinessTracker progress={readiness.progress} />
      </View>
    );
  }

  // Mirrors the "Build Around a Piece" hero card above — same size, same dark
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
            transition={600}
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
              Build From{'\n'}My Closet
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <AppText style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14, lineHeight: 20, maxWidth: '65%' }}>
              Create complete looks entirely from pieces you already own.
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

export function HeroCardContent({ accentColor, inverseColor }: { accentColor: string; inverseColor: string }) {
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
          Build Around{'\n'}a Piece
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
          Start with something you own and create complete looks around it.
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
