import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { AppIcon } from '@/components/ui/app-icon';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { spacing, theme as staticTheme } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { wardrobeScoreService } from '@/services/wardrobe-score';
import type {
  WardrobeScore,
  EssentialsCoverageScore,
  VersatilityFunctionalityScore,
  TrendRelevanceScore,
  TrendItemAnnotation,
} from '@/services/wardrobe-score';

// ── Score ring helpers ────────────────────────────────────────────────────────

const BAND_COLOR: Record<string, string> = {
  Exceptional: '#2D7D32',
  Strong:      '#558B2F',
  Solid:       '#A56A1F',   // accent
  Developing:  '#C0772A',
  'Needs Work': '#C95F4A',
};

function bandColor(band: string): string {
  return BAND_COLOR[band] ?? staticTheme.colors.accent;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const { theme } = useTheme();
  // Simple circular score display — clean typography, no SVG dependency
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 5,
        borderColor: staticTheme.colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surface,
      }}>
      <AppText
        style={{
          fontFamily: staticTheme.fonts.serif,
          fontSize: size * 0.3,
          color: theme.colors.text,
          lineHeight: size * 0.35,
        }}>
        {score}
      </AppText>
      <AppText
        style={{
          fontFamily: staticTheme.fonts.sansMedium,
          fontSize: 10,
          color: theme.colors.mutedText,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        }}>
        /100
      </AppText>
    </View>
  );
}

function DimensionBar({ label, score, maxScore = 100 }: { label: string; score: number; maxScore?: number }) {
  const { theme } = useTheme();
  const pct = Math.round((score / maxScore) * 100);
  const fill = score >= 75 ? '#558B2F' : score >= 55 ? staticTheme.colors.accent : '#C0772A';

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <AppText style={{ fontSize: 13, color: theme.colors.mutedText }}>{label}</AppText>
        <AppText style={{ fontFamily: staticTheme.fonts.sansMedium, fontSize: 13, color: theme.colors.text }}>{score}</AppText>
      </View>
      <View style={{ height: 4, backgroundColor: theme.colors.subtleSurface, borderRadius: 2 }}>
        <View style={{ height: 4, width: `${pct}%`, backgroundColor: fill, borderRadius: 2 }} />
      </View>
    </View>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 20,
        borderWidth: 1,
        padding: spacing.lg,
        gap: spacing.md,
      }}>
      {children}
    </View>
  );
}

function Eyebrow({ children }: { children: string }) {
  const { theme } = useTheme();
  return (
    <AppText
      style={{
        fontFamily: staticTheme.fonts.sansMedium,
        fontSize: 10,
        letterSpacing: 1.6,
        textTransform: 'uppercase',
        color: theme.colors.mutedText,
      }}>
      {children}
    </AppText>
  );
}

function GapCallout({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
      <AppIcon name="info" color={theme.colors.accent} size={13} />
      <AppText style={{ flex: 1, fontSize: 13, lineHeight: 19, color: theme.colors.mutedText }}>{text}</AppText>
    </View>
  );
}

function StrengthHighlight({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
      <AppIcon name="check-circle" color="#558B2F" size={13} />
      <AppText style={{ flex: 1, fontSize: 13, lineHeight: 19, color: theme.colors.text }}>{text}</AppText>
    </View>
  );
}

// ── Essentials Coverage Card ──────────────────────────────────────────────────

function EssentialsCoverageCard({ data }: { data: EssentialsCoverageScore }) {
  const [showMissing, setShowMissing] = useState(false);

  return (
    <SectionCard>
      <Eyebrow>Essentials Coverage</Eyebrow>
      <DimensionBar label={`${data.matchedCount} of ${data.totalEssentials} essentials covered`} score={data.score} />

      <View style={{ gap: spacing.sm }}>
        <DimensionBar label="Tier 1 — Foundations"  score={data.tier1Coverage} />
        <DimensionBar label="Tier 2 — Supporting"   score={data.tier2Coverage} />
        <DimensionBar label="Tier 3 — Nice to Have" score={data.tier3Coverage} />
      </View>

      {data.strengthHighlights.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          {data.strengthHighlights.map((s, i) => <StrengthHighlight key={i} text={s} />)}
        </View>
      )}

      {data.gapCallouts.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          {(showMissing ? data.gapCallouts : data.gapCallouts.slice(0, 3)).map((g, i) => (
            <GapCallout key={i} text={g} />
          ))}
          {data.gapCallouts.length > 3 && (
            <Pressable onPress={() => setShowMissing((p) => !p)}>
              <AppText style={{ fontSize: 12, color: staticTheme.colors.accent, fontFamily: staticTheme.fonts.sansMedium }}>
                {showMissing ? 'Show less' : `+${data.gapCallouts.length - 3} more gaps`}
              </AppText>
            </Pressable>
          )}
        </View>
      )}
    </SectionCard>
  );
}

// ── Versatility Card ──────────────────────────────────────────────────────────

function VersatilityCard({ data }: { data: VersatilityFunctionalityScore }) {
  return (
    <SectionCard>
      <Eyebrow>Versatility &amp; Functionality</Eyebrow>
      <DimensionBar label="Occasion spread" score={data.occasionSpread.score} />
      <DimensionBar label="Color distribution" score={data.colorDistribution.score} />
      <DimensionBar label="Category coverage" score={data.categoryGaps.score} />
      <DimensionBar label="Mix-and-match potential" score={data.mixAndMatch.score} />

      {data.mixAndMatch.estimatedCombinations > 0 && (
        <AppText style={{ fontSize: 12, color: staticTheme.colors.accent, fontFamily: staticTheme.fonts.sansMedium }}>
          ~{data.mixAndMatch.estimatedCombinations} outfit combinations estimated
        </AppText>
      )}

      {data.strengthHighlights.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          {data.strengthHighlights.map((s, i) => <StrengthHighlight key={i} text={s} />)}
        </View>
      )}

      {data.gapCallouts.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          {data.gapCallouts.slice(0, 3).map((g, i) => <GapCallout key={i} text={g} />)}
        </View>
      )}
    </SectionCard>
  );
}

// ── Trend Relevance Card ──────────────────────────────────────────────────────

function TrendLabel({ label }: { label: TrendItemAnnotation['label'] }) {
  const color = label === 'on-trend' ? '#558B2F' : label === 'dated' ? '#C95F4A' : '#9E8F85';
  const text = label === 'on-trend' ? 'On-trend' : label === 'dated' ? 'Dated' : 'Neutral';
  return (
    <View
      style={{
        borderRadius: 999,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        backgroundColor: `${color}18`,
        alignSelf: 'flex-start',
      }}>
      <AppText style={{ fontSize: 10, color, fontFamily: staticTheme.fonts.sansMedium, letterSpacing: 0.8, textTransform: 'uppercase' }}>
        {text}
      </AppText>
    </View>
  );
}

function TrendRelevanceCard({ data }: { data: TrendRelevanceScore }) {
  const { theme } = useTheme();
  const [showAll, setShowAll] = useState(false);

  if (data.hasFallback) {
    return (
      <SectionCard>
        <Eyebrow>Trend Relevance</Eyebrow>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
          <AppIcon name="info" color={theme.colors.subtleText} size={14} />
          <AppText style={{ flex: 1, fontSize: 13, lineHeight: 19, color: theme.colors.mutedText }}>
            {data.fallbackReason ?? 'Upload a style guide to enable trend relevance scoring.'}
          </AppText>
        </View>
      </SectionCard>
    );
  }

  const visibleAnnotations = showAll ? data.annotations : data.annotations.slice(0, 5);

  return (
    <SectionCard>
      <Eyebrow>Trend Relevance</Eyebrow>

      {data.score !== null && (
        <DimensionBar label="Alignment with your style guide" score={data.score} />
      )}

      {data.styleGuidesSummary && (
        <AppText style={{ fontSize: 13, lineHeight: 19, color: theme.colors.mutedText, fontStyle: 'italic' }}>
          "{data.styleGuidesSummary}"
        </AppText>
      )}

      {/* Stats row */}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {[
          { count: data.onTrendCount, label: 'On-trend', color: '#558B2F' },
          { count: data.neutralCount, label: 'Neutral', color: '#9E8F85' },
          { count: data.datedCount, label: 'Dated', color: '#C95F4A' },
        ].map(({ count, label, color }) => (
          <View key={label} style={{ flex: 1, backgroundColor: theme.colors.subtleSurface, borderRadius: 12, padding: spacing.sm, alignItems: 'center', gap: 3 }}>
            <AppText style={{ fontFamily: staticTheme.fonts.sansMedium, fontSize: 18, color }}>{count}</AppText>
            <AppText style={{ fontSize: 10, color: theme.colors.mutedText, letterSpacing: 0.6, textTransform: 'uppercase' }}>{label}</AppText>
          </View>
        ))}
      </View>

      {data.strengthHighlights.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          {data.strengthHighlights.map((s, i) => <StrengthHighlight key={i} text={s} />)}
        </View>
      )}

      {data.gapCallouts.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          {data.gapCallouts.map((g, i) => <GapCallout key={i} text={g} />)}
        </View>
      )}

      {/* Per-item annotations */}
      {data.annotations.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          <Eyebrow>Item-Level Analysis</Eyebrow>
          {visibleAnnotations.map((a) => (
            <View key={a.itemId} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                <AppText style={{ flex: 1, fontSize: 13, fontFamily: staticTheme.fonts.sansMedium }}>{a.itemTitle}</AppText>
                <TrendLabel label={a.label} />
              </View>
              <AppText style={{ fontSize: 12, color: theme.colors.mutedText, lineHeight: 17 }}>{a.rationale}</AppText>
            </View>
          ))}

          {data.annotations.length > 5 && (
            <Pressable onPress={() => setShowAll((p) => !p)}>
              <AppText style={{ fontSize: 12, color: staticTheme.colors.accent, fontFamily: staticTheme.fonts.sansMedium }}>
                {showAll ? 'Show less' : `Show all ${data.annotations.length} items`}
              </AppText>
            </Pressable>
          )}
        </View>
      )}
    </SectionCard>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export function WardrobeScoreScreen() {
  const { theme } = useTheme();
  const [score, setScore] = useState<WardrobeScore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadScore = useCallback(async (force = false) => {
    try {
      const result = await wardrobeScoreService.getScore(force);
      setScore(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wardrobe score.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadScore(false).finally(() => setIsLoading(false));
    }, [loadScore])
  );

  async function handleRefresh() {
    setIsRefreshing(true);
    await loadScore(true);
    setIsRefreshing(false);
  }

  return (
    <AppScreen
      scrollable
      backButton
      topInset
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void handleRefresh()}
          tintColor={theme.colors.accent}
        />
      }>
      <View style={{ gap: spacing.xl }}>

        {/* Header */}
        <View style={{ gap: spacing.xs }}>
          <AppText variant="heroSmall">Wardrobe Score</AppText>
          <AppText tone="muted">Your personal style intelligence report.</AppText>
        </View>

        {/* Loading state */}
        {isLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            <AppText tone="muted" style={{ marginTop: spacing.md, fontSize: 13 }}>Analysing your wardrobe…</AppText>
          </View>

        ) : error ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.md }}>
            <AppText tone="muted" style={{ textAlign: 'center' }}>{error}</AppText>
            <Pressable onPress={() => void handleRefresh()}>
              <AppText style={{ color: theme.colors.accent, fontFamily: staticTheme.fonts.sansMedium, fontSize: 14 }}>
                Try again
              </AppText>
            </Pressable>
          </View>

        ) : score ? (
          <>
            {/* ── Hero composite score ──────────────────────────────────────── */}
            <View
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: 24,
                borderWidth: 1,
                padding: spacing.xl,
                alignItems: 'center',
                gap: spacing.md,
              }}>
              <ScoreRing score={score.compositeScore} size={130} />

              <View style={{ alignItems: 'center', gap: spacing.xs }}>
                <AppText
                  style={{
                    fontFamily: staticTheme.fonts.serif,
                    fontSize: 22,
                    color: bandColor(score.scoreBand),
                    letterSpacing: 0.3,
                  }}>
                  {score.scoreBand}
                </AppText>
                <AppText
                  tone="muted"
                  style={{ textAlign: 'center', fontSize: 13, lineHeight: 19, paddingHorizontal: spacing.md }}>
                  {score.scoreBandDescription}
                </AppText>
              </View>

              <AppText
                style={{
                  textAlign: 'center',
                  fontSize: 14,
                  lineHeight: 21,
                  paddingHorizontal: spacing.sm,
                  color: theme.colors.text,
                }}>
                {score.summary}
              </AppText>

              {/* Dimension overview */}
              <View style={{ width: '100%', gap: spacing.sm, paddingTop: spacing.sm }}>
                <DimensionBar label="Essentials Coverage"         score={score.dimensions.essentialsCoverage.score} />
                <DimensionBar label="Versatility & Functionality" score={score.dimensions.versatilityFunctionality.score} />
                <DimensionBar
                  label="Trend Relevance"
                  score={score.dimensions.trendRelevance.score ?? 0}
                />
              </View>

              {/* Metadata */}
              <AppText
                style={{
                  fontSize: 10,
                  color: theme.colors.subtleText,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}>
                {score.metadata.closetItemCount} items · v{score.metadata.scoringVersion}
              </AppText>
            </View>

            {/* ── Strengths summary ─────────────────────────────────────────── */}
            {score.strengthHighlights.length > 0 && (
              <SectionCard>
                <Eyebrow>Strengths</Eyebrow>
                <View style={{ gap: spacing.sm }}>
                  {score.strengthHighlights.map((s, i) => <StrengthHighlight key={i} text={s} />)}
                </View>
              </SectionCard>
            )}

            {/* ── Top gap callouts ──────────────────────────────────────────── */}
            {score.gapCallouts.length > 0 && (
              <SectionCard>
                <Eyebrow>Gaps to Address</Eyebrow>
                <View style={{ gap: spacing.sm }}>
                  {score.gapCallouts.map((g, i) => <GapCallout key={i} text={g} />)}
                </View>
              </SectionCard>
            )}

            {/* ── Dimension breakdowns ──────────────────────────────────────── */}
            <EssentialsCoverageCard data={score.dimensions.essentialsCoverage} />
            <VersatilityCard data={score.dimensions.versatilityFunctionality} />
            <TrendRelevanceCard data={score.dimensions.trendRelevance} />

            {/* Refresh note */}
            <AppText
              tone="muted"
              style={{ textAlign: 'center', fontSize: 11, paddingBottom: spacing.xl }}>
              Pull to refresh · Trend score updates every 4 hours
            </AppText>
          </>
        ) : null}
      </View>
    </AppScreen>
  );
}
