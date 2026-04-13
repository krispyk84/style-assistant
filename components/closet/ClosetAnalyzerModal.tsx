import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing, theme } from '@/constants/theme';
import { STYLISTS } from '@/lib/stylists';
import type { ClosetAnalyseRecommendation, ClosetAnalyseStylist } from '@/types/api';
import type { useClosetAnalyzer } from './useClosetAnalyzer';

// ── Constants ─────────────────────────────────────────────────────────────────

const LOADING_MESSAGES = [
  'Vittorio is reviewing your wardrobe...',
  'Alessandra is weighing in...',
  'Calculating your closet score...',
  'Curating recommendations...',
];

const SUB_SCORE_LABELS: { key: keyof NonNullable<ReturnType<typeof useClosetAnalyzer>['result']>['sub_scores']; label: string }[] = [
  { key: 'formality_range', label: 'FORMALITY RANGE' },
  { key: 'color_versatility', label: 'COLOR VERSATILITY' },
  { key: 'seasonal_coverage', label: 'SEASONAL COVERAGE' },
  { key: 'layering_options', label: 'LAYERING OPTIONS' },
  { key: 'occasion_coverage', label: 'OCCASION COVERAGE' },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type ClosetAnalyzerModalProps = {
  hook: ReturnType<typeof useClosetAnalyzer>;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ClosetAnalyzerModal({ hook }: ClosetAnalyzerModalProps) {
  const { height: screenHeight } = useWindowDimensions();

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (!hook.isOpen) return;
    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(600);
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: 0, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hook.isOpen]);

  function dismissAndClose() {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: 600, duration: 240, useNativeDriver: true }),
    ]).start(() => hook.close());
  }

  return (
    <Modal animationType="none" transparent visible={hook.isOpen} onRequestClose={dismissAndClose}>
      <Animated.View
        pointerEvents="none"
        style={{
          backgroundColor: 'rgba(24, 18, 14, 0.52)',
          bottom: 0,
          left: 0,
          opacity: backdropOpacity,
          position: 'absolute',
          right: 0,
          top: 0,
        }}
      />
      <Pressable style={{ flex: 1, justifyContent: 'flex-end' }} onPress={dismissAndClose}>
        <Animated.View
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            maxHeight: screenHeight * 0.9,
            overflow: 'hidden',
            transform: [{ translateY: sheetTranslateY }],
          }}>
          <Pressable onPress={() => undefined} style={{ flex: 1 }}>
            {/* Drag handle */}
            <View style={{ alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.xs }}>
              <View style={{ backgroundColor: theme.colors.border, borderRadius: 999, height: 4, width: 36 }} />
            </View>

            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingTop: spacing.md }}>

              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ gap: 2 }}>
                  <AppText variant="sectionTitle">Analyse My Closet</AppText>
                  <AppText tone="muted" style={{ fontSize: 13 }}>Wardrobe completeness report</AppText>
                </View>
                <Pressable hitSlop={8} onPress={dismissAndClose}>
                  <Ionicons color={theme.colors.mutedText} name="close" size={22} />
                </Pressable>
              </View>

              {/* Content */}
              {hook.modalState === 'loading' ? (
                <LoadingView />
              ) : hook.modalState === 'result' && hook.result ? (
                <ResultsView result={hook.result} onRefresh={hook.refresh} onClose={dismissAndClose} />
              ) : (
                <ErrorView error={hook.error} onRetry={hook.refresh} onClose={dismissAndClose} />
              )}
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ── Loading view ──────────────────────────────────────────────────────────────

function LoadingView() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }}>
      <ActivityIndicator color={theme.colors.accent} size="large" />
      <AppText tone="muted" style={{ textAlign: 'center' }}>
        {LOADING_MESSAGES[messageIndex]}
      </AppText>
    </View>
  );
}

// ── Error view ────────────────────────────────────────────────────────────────

type ErrorViewProps = {
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
};

function ErrorView({ error, onRetry, onClose }: ErrorViewProps) {
  return (
    <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }}>
      <Ionicons color={theme.colors.danger} name="alert-circle-outline" size={36} />
      <AppText style={{ textAlign: 'center', color: theme.colors.danger }}>
        {error ?? 'Something went wrong. Please try again.'}
      </AppText>
      <PrimaryButton label="Try again" onPress={onRetry} variant="secondary" />
      <Pressable hitSlop={8} onPress={onClose}>
        <AppText tone="muted" style={{ fontSize: 13 }}>Close</AppText>
      </Pressable>
    </View>
  );
}

// ── Results view ──────────────────────────────────────────────────────────────

type ResultsViewProps = {
  result: NonNullable<ReturnType<typeof useClosetAnalyzer>['result']>;
  onRefresh: () => void;
  onClose: () => void;
};

function ResultsView({ result, onRefresh, onClose }: ResultsViewProps) {
  return (
    <View style={{ gap: spacing.xl }}>
      <ScoreSection result={result} />
      <Divider />
      <StylistSection stylistId="vittorio" data={result.vittorio} />
      <Divider />
      <StylistSection stylistId="alessandra" data={result.alessandra} />
      <Footer onRefresh={onRefresh} onClose={onClose} />
    </View>
  );
}

// ── Score section ─────────────────────────────────────────────────────────────

type ScoreSectionProps = {
  result: NonNullable<ReturnType<typeof useClosetAnalyzer>['result']>;
};

function ScoreSection({ result }: ScoreSectionProps) {
  return (
    <View style={{ gap: spacing.lg }}>
      {/* Score display */}
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
          CLOSET VERSATILITY SCORE
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <AppText style={{ fontSize: 56, fontFamily: theme.fonts.sansMedium, lineHeight: 64 }}>
            {result.total_score}
          </AppText>
          <AppText tone="muted" style={{ fontSize: 22 }}> / 100</AppText>
        </View>
      </View>

      {/* Summary */}
      <AppText style={{ fontSize: 14, lineHeight: 22, color: theme.colors.mutedText, textAlign: 'center' }}>
        {result.summary}
      </AppText>

      {/* Sub-score bars */}
      <View style={{ gap: spacing.sm }}>
        {SUB_SCORE_LABELS.map(({ key, label }) => (
          <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <AppText
              variant="eyebrow"
              style={{ color: theme.colors.mutedText, fontSize: 10, letterSpacing: 1.2, width: 128 }}>
              {label}
            </AppText>
            <View
              style={{
                flex: 1,
                backgroundColor: theme.colors.border,
                borderRadius: 999,
                height: 6,
                overflow: 'hidden',
              }}>
              <View
                style={{
                  width: `${(result.sub_scores[key] / 10) * 100}%`,
                  backgroundColor: theme.colors.accent,
                  height: '100%',
                  borderRadius: 999,
                }}
              />
            </View>
            <AppText style={{ fontSize: 11, fontFamily: theme.fonts.sansMedium, width: 16, textAlign: 'right' }}>
              {result.sub_scores[key]}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Stylist section ───────────────────────────────────────────────────────────

type StylistSectionProps = {
  stylistId: 'vittorio' | 'alessandra';
  data: ClosetAnalyseStylist;
};

function StylistSection({ stylistId, data }: StylistSectionProps) {
  const stylist = STYLISTS.find((s) => s.id === stylistId)!;

  return (
    <View style={{ gap: spacing.md }}>
      {/* Stylist header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            borderColor: theme.colors.border,
            borderRadius: 24,
            borderWidth: 1,
            height: 40,
            overflow: 'hidden',
            width: 40,
          }}>
          <Image
            contentFit="cover"
            contentPosition="top"
            source={stylist.image}
            style={{ height: '100%', width: '100%' }}
          />
        </View>
        <View style={{ gap: 1 }}>
          <AppText style={{ fontSize: 13, fontFamily: theme.fonts.sansMedium }}>{stylist.name}</AppText>
          <AppText tone="muted" style={{ fontSize: 11 }}>recommends</AppText>
        </View>
      </View>

      {/* Content */}
      {!data.has_recommendations ? (
        <AppText style={{ fontSize: 13, fontStyle: 'italic', color: theme.colors.mutedText }}>
          &ldquo;{data.no_gap_message}&rdquo;
        </AppText>
      ) : (
        data.recommendations.map((rec, i) => (
          <RecommendationCard key={i} rec={rec} />
        ))
      )}
    </View>
  );
}

// ── Recommendation card ───────────────────────────────────────────────────────

function RecommendationCard({ rec }: { rec: ClosetAnalyseRecommendation }) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.border,
        borderRadius: 16,
        borderWidth: 1,
        gap: spacing.sm,
        padding: spacing.md,
      }}>
      <AppText variant="sectionTitle">{rec.piece_name}</AppText>
      <AppText style={{ fontSize: 13, fontStyle: 'italic', color: theme.colors.mutedText }}>
        &ldquo;{rec.reason}&rdquo;
      </AppText>
      {rec.versatility_tags.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {rec.versatility_tags.map((tag) => (
            <View
              key={tag}
              style={{
                borderColor: theme.colors.border,
                borderRadius: 999,
                borderWidth: 1,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
              }}>
              <AppText style={{ color: theme.colors.mutedText, fontSize: 11 }}>{tag}</AppText>
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 4, justifyContent: 'flex-end' }}>
        <AppText style={{ color: theme.colors.mutedText, fontSize: 11 }}>Impact</AppText>
        <AppText style={{ color: theme.colors.accent, fontSize: 11, fontFamily: theme.fonts.sansMedium }}>
          {rec.impact_score} / 10
        </AppText>
      </View>
    </View>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer({ onRefresh, onClose }: { onRefresh: () => void; onClose: () => void }) {
  return (
    <View style={{ gap: spacing.md, alignItems: 'center' }}>
      <Pressable hitSlop={8} onPress={onRefresh}>
        <AppText style={{ color: theme.colors.mutedText, fontSize: 12, textDecorationLine: 'underline' }}>
          Refresh analysis
        </AppText>
      </Pressable>
      <PrimaryButton label="Close" onPress={onClose} />
    </View>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────

function Divider() {
  return <View style={{ backgroundColor: theme.colors.border, height: 1 }} />;
}
