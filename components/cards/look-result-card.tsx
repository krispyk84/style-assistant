import { Ionicons } from '@expo/vector-icons';
import { Href, Link } from 'expo-router';
import { Animated, ActivityIndicator, Easing, Pressable, View } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';

import { spacing, theme } from '@/constants/theme';
import { formatTierLabel } from '@/lib/outfit-utils';
import { findBestClosetMatch, isClosetMatchValid } from '@/lib/closet-match';
import { ClosetItemSheet } from '@/components/closet/closet-item-sheet';
import type { LookRecommendation } from '@/types/look-request';
import type { ClosetItem } from '@/types/closet';
import { AppText } from '@/components/ui/app-text';
import { RemoteImagePanel } from '@/components/ui/remote-image-panel';

type LookResultCardProps = {
  recommendation: LookRecommendation;
  onRegenerate: () => void;
  detailHref: Href;
  isRegenerating?: boolean;
  isSaved?: boolean;
  isSaving?: boolean;
  onSave?: () => void;
  onAddToWeek?: () => void;
  onSecondOpinion?: () => void;
  /** Closet items — used as fallback matching when matchMap is not yet populated. */
  closetItems?: ClosetItem[];
  /** Pre-computed LLM matches: suggestion string → ClosetItem or null. When provided, takes precedence over local scoring. */
  matchMap?: Record<string, ClosetItem | null>;
  /** Called when thumbs-up is given for a specific matched item. */
  onMatchThumbsUp?: (suggestion: string, matchedItemId: string) => void;
  /** Called when thumbs-down is given for a specific matched item, triggering rematch. */
  onMatchThumbsDown?: (suggestion: string, matchedItemId: string) => void;
  /** Persisted per-suggestion feedback: suggestion → 'up' | 'down' | null. */
  matchFeedbackMap?: Record<string, 'up' | 'down' | null>;
  /** Suggestions currently being rematched — shows a loading indicator on that piece row. */
  regeneratingMatches?: Set<string>;
};

export function LookResultCard({
  recommendation,
  onRegenerate,
  detailHref,
  isRegenerating = false,
  isSaved = false,
  isSaving = false,
  onSave,
  onAddToWeek,
  onSecondOpinion,
  closetItems = [],
  matchMap,
  onMatchThumbsUp,
  onMatchThumbsDown,
  matchFeedbackMap,
  regeneratingMatches,
}: LookResultCardProps) {
  // Track which piece + suggestion is open in the sheet
  const [matchedPiece, setMatchedPiece] = useState<{ item: ClosetItem; suggestion: string } | null>(null);

  const labeledPieces = useMemo(
    () => buildLabeledPieces(recommendation, closetItems, matchMap),
    [recommendation, closetItems, matchMap]
  );
  const hasAnyMatch = labeledPieces.some((p) => p.matchedClosetItem !== null);

  if (isRegenerating) {
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
          <AppText variant="title">{formatTierLabel(recommendation.tier)}</AppText>
        </View>
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
              Generating new outfit...
            </AppText>
            <AppText tone="muted" style={{ textAlign: 'center' }}>
              Your new look will appear here in a moment.
            </AppText>
          </View>
        </View>
      </View>
    );
  }

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
        <AppText variant="title">{formatTierLabel(recommendation.tier)}</AppText>
        <AppText tone="muted">{recommendation.title}</AppText>
      </View>

      <TierSketch recommendation={recommendation} />

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Pressable
          disabled={isSaved || isSaving || !onSave}
          onPress={onSave}
          style={[
            actionButtonStyle,
            { backgroundColor: isSaved ? theme.colors.border : theme.colors.card },
          ]}>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
            <Ionicons
              color={theme.colors.text}
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={18}
            />
            <AppText>{isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Save outfit'}</AppText>
          </View>
        </Pressable>
        <Pressable disabled={!onAddToWeek} onPress={onAddToWeek} style={actionButtonStyle}>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
            <Ionicons color={theme.colors.text} name="calendar-outline" size={18} />
            <AppText>Add to week</AppText>
          </View>
        </Pressable>
      </View>

      {/* Pieces list with optional closet-match legend + inline checkmarks */}
      <View style={{ gap: spacing.sm }}>
        {hasAnyMatch ? (
          <View
            style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs, paddingBottom: spacing.xs }}>
            <Ionicons color={theme.colors.accent} name="checkmark-circle-outline" size={13} />
            <AppText tone="muted" style={{ fontSize: 12 }}>
              You already own a similar piece
            </AppText>
          </View>
        ) : null}

        {labeledPieces.map((piece) => {
          const isRematching = regeneratingMatches?.has(piece.value) ?? false;
          return (
            <View
              key={`${piece.label}-${piece.value}`}
              style={{
                alignItems: 'flex-start',
                borderBottomColor: theme.colors.border,
                borderBottomWidth: 1,
                flexDirection: 'row',
                gap: spacing.xs,
                paddingBottom: spacing.sm,
              }}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <AppText variant="sectionTitle">{piece.label}</AppText>
                <AppText tone="muted">{piece.value}</AppText>
              </View>
              {isRematching ? (
                <ActivityIndicator color={theme.colors.accent} size="small" style={{ paddingTop: 2 }} />
              ) : piece.matchedClosetItem ? (
                <Pressable
                  accessibilityLabel={`You own a similar piece: ${piece.matchedClosetItem.title}. Tap to view and rate.`}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => setMatchedPiece({ item: piece.matchedClosetItem!, suggestion: piece.value })}
                  style={{ paddingTop: 2 }}>
                  <Ionicons color={theme.colors.accent} name="checkmark-circle" size={22} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>

      <CardSection title="Fit notes" items={recommendation.fitNotes} />

      <View style={{ gap: spacing.xs }}>
        <AppText variant="sectionTitle">Why it works</AppText>
        <AppText tone="muted">{recommendation.whyItWorks}</AppText>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Pressable
          disabled={isRegenerating}
          onPress={onRegenerate}
          style={[
            actionButtonStyle,
            { backgroundColor: theme.colors.text, opacity: isRegenerating ? 0.7 : 1 },
          ]}>
          <AppText style={{ color: theme.colors.background }}>
            {isRegenerating ? 'Regenerating...' : 'Regenerate'}
          </AppText>
        </Pressable>
        <Link href={detailHref} asChild>
          <Pressable style={actionButtonStyle}>
            <AppText>View Look</AppText>
          </Pressable>
        </Link>
      </View>

      <Pressable
        onPress={onSecondOpinion}
        style={[
          actionButtonStyle,
          {
            flexDirection: 'row',
            gap: spacing.xs,
            flex: undefined,
            width: '100%',
            borderColor: theme.colors.accent,
          },
        ]}>
        <Ionicons color={theme.colors.accent} name="chatbubble-ellipses-outline" size={18} />
        <AppText style={{ color: theme.colors.accent }}>Second Opinion</AppText>
      </Pressable>

      {/* Bottom sheet shown when user taps a checkmark — includes per-match feedback */}
      {matchedPiece ? (() => {
        // Derive the current item live from labeledPieces so the sheet auto-updates after rematch
        const currentItem = labeledPieces.find(p => p.value === matchedPiece.suggestion)?.matchedClosetItem ?? null;
        const isRematching = regeneratingMatches?.has(matchedPiece.suggestion) ?? false;
        return (
          <ClosetItemSheet
            item={currentItem}
            isRematching={isRematching}
            thumbsFeedback={matchFeedbackMap?.[matchedPiece.suggestion] ?? null}
            onThumbsUp={
              onMatchThumbsUp && currentItem
                ? () => onMatchThumbsUp(matchedPiece.suggestion, currentItem.id)
                : undefined
            }
            onThumbsDown={
              onMatchThumbsDown && currentItem
                ? () => onMatchThumbsDown(matchedPiece.suggestion, currentItem.id)
                : undefined
            }
            onClose={() => setMatchedPiece(null)}
          />
        );
      })() : null}
    </View>
  );
}

// ── Piece list construction ────────────────────────────────────────────────────

type LabeledPiece = {
  label: string;
  value: string;
  matchedClosetItem: ClosetItem | null;
};

function resolveMatch(
  suggestion: string,
  closetItems: ClosetItem[],
  matchMap?: Record<string, ClosetItem | null>
): ClosetItem | null {
  if (matchMap && Object.prototype.hasOwnProperty.call(matchMap, suggestion)) {
    const llmResult = matchMap[suggestion] ?? null;
    if (llmResult) {
      // Validate the LLM match with local category logic to reject obvious
      // cross-category mismatches (e.g. watch suggestion → rash guard item).
      if (isClosetMatchValid(suggestion, llmResult)) return llmResult;
      return findBestClosetMatch(suggestion, closetItems);
    }
    // LLM returned null — run local scoring as a safety net.
    return findBestClosetMatch(suggestion, closetItems);
  }
  // matchMap not yet populated — fall back to local scoring while LLM loads
  return findBestClosetMatch(suggestion, closetItems);
}

function buildLabeledPieces(
  recommendation: LookRecommendation,
  closetItems: ClosetItem[],
  matchMap?: Record<string, ClosetItem | null>
): LabeledPiece[] {
  const usedLabels = new Set<string>();

  const pieces: LabeledPiece[] = recommendation.keyPieces.map((piece, index) => ({
    label: uniqueLabel(labelForKeyPiece(piece, index), usedLabels),
    value: piece,
    matchedClosetItem: resolveMatch(piece, closetItems, matchMap),
  }));

  recommendation.shoes.forEach((shoe, index) => {
    pieces.push({
      label: uniqueLabel(index === 0 ? 'Shoes' : `Shoe ${index + 1}`, usedLabels),
      value: shoe,
      matchedClosetItem: resolveMatch(shoe, closetItems, matchMap),
    });
  });

  recommendation.accessories.forEach((accessory, index) => {
    pieces.push({
      label: uniqueLabel(`Accessory ${index + 1}`, usedLabels),
      value: accessory,
      matchedClosetItem: resolveMatch(accessory, closetItems, matchMap),
    });
  });

  return pieces;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function uniqueLabel(baseLabel: string, usedLabels: Set<string>): string {
  if (!usedLabels.has(baseLabel)) {
    usedLabels.add(baseLabel);
    return baseLabel;
  }

  let counter = 2;
  let nextLabel = `${baseLabel} ${counter}`;
  while (usedLabels.has(nextLabel)) {
    counter += 1;
    nextLabel = `${baseLabel} ${counter}`;
  }

  usedLabels.add(nextLabel);
  return nextLabel;
}

function labelForKeyPiece(piece: string, index: number): string {
  const normalized = piece.toLowerCase();

  if (/(suit|blazer|jacket|coat|topcoat|overshirt|chore)/.test(normalized)) return 'Outerwear';
  if (/(shirt|tee|t-shirt|polo|crewneck|sweater|knit|cardigan|hoodie)/.test(normalized)) return 'Top';
  if (/(trouser|pant|pants|jean|denim)/.test(normalized)) return 'Pants';
  if (/(shorts)/.test(normalized)) return 'Shorts';

  return index === 0 ? 'Piece 1' : `Piece ${index + 1}`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

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
            This illustration will appear automatically when it is ready.
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

function CardSection({ title, items }: { title: string; items: string[] }) {
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

const actionButtonStyle = {
  alignItems: 'center',
  backgroundColor: theme.colors.card,
  borderColor: theme.colors.border,
  borderRadius: 999,
  borderWidth: 1,
  flex: 1,
  justifyContent: 'center',
  minHeight: 48,
  paddingHorizontal: spacing.md,
} as const;
