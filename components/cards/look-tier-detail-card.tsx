import { View } from 'react-native';

import { GeneratedSketchPanel } from '@/components/generated/GeneratedSketchPanel';
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
        overflow: 'hidden',
      }}>
      <View style={{ gap: 2, paddingBottom: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        <AppText variant="eyebrow" style={{ color: theme.colors.accent }}>{definition.label}</AppText>
        <AppText variant="display">{recommendation.title}</AppText>
      </View>

      <TierSketch recommendation={recommendation} />

      <View style={{ gap: spacing.lg, padding: spacing.lg }}>
        <Section title="Best for" body={definition.bestFor.join(' • ')} />
        <Section title="Palette cues" body={definition.palette.join(' • ')} />
      </View>
    </View>
  );
}

function TierSketch({ recommendation }: { recommendation: LookRecommendation }) {
  return (
    <GeneratedSketchPanel
      status={recommendation.sketchStatus}
      imageUrl={recommendation.sketchImageUrl}
      minHeight={280}
      borderRadius={0}
      pendingMessage="This tier illustration will appear automatically when it is ready."
    />
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="eyebrow" style={{ color: theme.colors.mutedText }}>{title}</AppText>
      <AppText tone="muted">{body}</AppText>
    </View>
  );
}
