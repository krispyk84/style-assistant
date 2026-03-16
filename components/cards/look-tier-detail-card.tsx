import { View } from 'react-native';
import { Image } from 'expo-image';

import { spacing, theme } from '@/constants/theme';
import type { LookRecommendation, LookTierDefinition } from '@/types/look-request';
import { AppText } from '@/components/ui/app-text';

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
      <Image
        source={{ uri: recommendation.sketchImageUrl }}
        style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 22, backgroundColor: theme.colors.card }}
        contentFit="cover"
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

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="sectionTitle">{title}</AppText>
      <AppText tone="muted">{body}</AppText>
    </View>
  );
}
