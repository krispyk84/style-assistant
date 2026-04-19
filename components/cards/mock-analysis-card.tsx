import { View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import type { AnalysisResponse, FidelityLabel, StrengthLabel } from '@/types/api';
import { AppText } from '@/components/ui/app-text';

type MockAnalysisCardProps = {
  title: string;
  response: AnalysisResponse;
};

const STRENGTH_COLOR: Record<StrengthLabel, string> = {
  Strong:   '#C5A46D',
  Moderate: '#D8C39A',
  Weak:     '#D26A5C',
};

const FIDELITY_COLOR: Record<FidelityLabel, string> = {
  Close:    '#C5A46D',
  Adjusted: '#D8C39A',
  Different:'#D26A5C',
};

export function MockAnalysisCard({ title, response }: MockAnalysisCardProps) {
  const verdictColor =
    response.verdict === 'Works great'
      ? '#C5A46D'
      : response.verdict === 'Works okay'
        ? '#D8C39A'
        : '#D26A5C';

  // ── new structured layout ────────────────────────────
  const hasNewCompatibility = response.itemMatch != null || response.outfitFit != null;
  const hasNewSelfie        = response.lookFidelity != null || response.overallLook != null;

  if (hasNewCompatibility || hasNewSelfie) {
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
        {response.summary ? <BodySection title="Summary" body={response.summary} /> : null}
        {hasNewCompatibility && (
          <View style={{ gap: spacing.sm }}>
            {response.itemMatch ? (
              <ScoreRow
                label="Item match"
                value={response.itemMatch}
                color={STRENGTH_COLOR[response.itemMatch]}
              />
            ) : null}
            {response.outfitFit ? (
              <ScoreRow
                label="Outfit fit"
                value={response.outfitFit}
                color={STRENGTH_COLOR[response.outfitFit]}
              />
            ) : null}
          </View>
        )}
        {hasNewSelfie && (
          <View style={{ gap: spacing.sm }}>
            {response.lookFidelity ? (
              <ScoreRow
                label="Look fidelity"
                value={response.lookFidelity}
                color={FIDELITY_COLOR[response.lookFidelity]}
              />
            ) : null}
            {response.overallLook ? (
              <ScoreRow
                label="Overall look"
                value={response.overallLook}
                color={STRENGTH_COLOR[response.overallLook]}
              />
            ) : null}
          </View>
        )}
        {response.outfitImpact?.length ? <Section title="Outfit impact" items={response.outfitImpact} /> : null}
        {response.substitutionImpact?.length ? <Section title="Substitution impact" items={response.substitutionImpact} /> : null}
      </View>
    );
  }

  // ── legacy layout (historical results) ───────────────
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

function ScoreRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <AppText tone="muted" style={{ fontSize: 13 }}>{label}</AppText>
      <AppText style={{ color, fontSize: 13, fontFamily: theme.fonts.sansMedium }}>{value}</AppText>
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
