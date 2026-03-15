import { View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import type { AnalysisResponse } from '@/types/api';
import { AppText } from '@/components/ui/app-text';

type MockAnalysisCardProps = {
  title: string;
  response: AnalysisResponse;
};

export function MockAnalysisCard({ title, response }: MockAnalysisCardProps) {
  const verdictColor =
    response.verdict === 'Works great'
      ? '#C5A46D'
      : response.verdict === 'Works okay'
        ? '#D8C39A'
        : '#D26A5C';

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
        <AppText variant="sectionTitle">{title}</AppText>
        <AppText style={{ color: verdictColor }}>{response.verdict}</AppText>
      </View>
      {response.explanation ? <BodySection title="Explanation" body={response.explanation} /> : null}
      {response.strengths?.length ? <Section title="Strengths" items={response.strengths} /> : null}
      {response.issues?.length ? <Section title="Issues" items={response.issues} /> : null}
      {response.recommendedAdjustments?.length ? <Section title="Recommended adjustments" items={response.recommendedAdjustments} /> : null}
      {response.concerns?.length ? <Section title="Concerns" items={response.concerns} /> : null}
      {response.suggestedAlternatives?.length ? <Section title="Suggested alternatives" items={response.suggestedAlternatives} /> : null}
      {!response.explanation && response.stylistNotes.length ? <Section title="Stylist notes" items={response.stylistNotes} /> : null}
      {!response.recommendedAdjustments?.length && !response.suggestedAlternatives?.length && response.suggestedChanges.length ? (
        <Section title="Suggested changes" items={response.suggestedChanges} />
      ) : null}
    </View>
  );
}

function BodySection({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="sectionTitle">{title}</AppText>
      <AppText tone="muted">{body}</AppText>
    </View>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="sectionTitle">{title}</AppText>
      {items.map((item) => (
        <AppText key={item} tone="muted">
          • {item}
        </AppText>
      ))}
    </View>
  );
}
