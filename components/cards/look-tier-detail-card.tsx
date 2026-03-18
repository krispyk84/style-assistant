import { Animated, Easing, View } from 'react-native';
import { useEffect, useRef } from 'react';

import { spacing, theme } from '@/constants/theme';
import type { LookRecommendation, LookTierDefinition } from '@/types/look-request';
import { AppText } from '@/components/ui/app-text';
import { RemoteImagePanel } from '@/components/ui/remote-image-panel';

type LookTierDetailCardProps = {
  definition: LookTierDefinition;
  recommendation: LookRecommendation;
};

export function LookTierDetailCard({ definition, recommendation }: LookTierDetailCardProps) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 28,
        borderWidth: 1,
        gap: spacing.lg,
        padding: spacing.lg,
      }}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="eyebrow">{definition.label}</AppText>
        <AppText variant="title">{recommendation.title}</AppText>
      </View>

      <TierSketch recommendation={recommendation} />

      <Section title="Best for" body={definition.bestFor.join(' • ')} />
      <Section title="Palette cues" body={definition.palette.join(' • ')} />
    </View>
  );
}

function TierSketch({ recommendation }: { recommendation: LookRecommendation }) {
  if (recommendation.sketchStatus === 'ready' && recommendation.sketchImageUrl) {
    return (
      <RemoteImagePanel
        uri={recommendation.sketchImageUrl}
        aspectRatio={3 / 4}
        minHeight={280}
        fallbackTitle="Sketch unavailable"
        fallbackMessage="The illustration could not be displayed on this device."
      />
    );
  }

  if (recommendation.sketchStatus === 'pending' || !recommendation.sketchStatus) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderRadius: 22,
          borderWidth: 1,
          justifyContent: 'center',
          minHeight: 280,
          padding: spacing.lg,
        }}>
        <AnimatedLoadingBar />
        <View style={{ gap: spacing.xs }}>
          <AppText variant="sectionTitle" style={{ textAlign: 'center' }}>
            Rendering sketch...
          </AppText>
          <AppText tone="muted" style={{ textAlign: 'center' }}>
            This tier illustration will appear automatically when it is ready.
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.border,
        borderRadius: 22,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 180,
        padding: spacing.lg,
      }}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="sectionTitle" style={{ textAlign: 'center' }}>
          Sketch unavailable
        </AppText>
        <AppText tone="muted" style={{ textAlign: 'center' }}>
          The outfit details are still usable even when the illustration is unavailable.
        </AppText>
      </View>
    </View>
  );
}

function AnimatedLoadingBar() {
  const translateX = useRef(new Animated.Value(-140)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 220,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -140,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [translateX]);

  return (
    <View
      style={{
        backgroundColor: theme.colors.border,
        borderRadius: 999,
        height: 10,
        marginBottom: spacing.md,
        overflow: 'hidden',
        width: '100%',
      }}>
      <Animated.View
        style={{
          backgroundColor: theme.colors.accent,
          borderRadius: 999,
          height: '100%',
          transform: [{ translateX }],
          width: 140,
        }}
      />
    </View>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="sectionTitle">{title}</AppText>
      <AppText tone="muted">{body}</AppText>
    </View>
  );
}
