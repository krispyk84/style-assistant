import { Ionicons } from '@expo/vector-icons';
import { Href, Link } from 'expo-router';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useEffect, useRef } from 'react';

import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { formatTierLabel } from '@/lib/outfit-utils';
import { ClosetItemSheet } from '@/components/closet/closet-item-sheet';
import type { LookRecommendation } from '@/types/look-request';
import type { ClosetItem } from '@/types/closet';
import { AppText } from '@/components/ui/app-text';
import { RemoteImagePanel } from '@/components/ui/remote-image-panel';
import { TierPieceListView } from './TierPieceListView';
import { useLookResultCard } from './useLookResultCard';

// ── Props ──────────────────────────────────────────────────────────────────────

export type LookResultCardViewProps = {
  recommendation: LookRecommendation;
  detailHref: Href;
  isSaved?: boolean;
  isSaving?: boolean;
  onSave?: () => void;
  onAddToWeek?: () => void;
  onSecondOpinion?: () => void;
  /** Closet items — used as fallback matching when matchMap is not yet populated. */
  closetItems?: ClosetItem[];
  /**
   * Pre-computed LLM matches: suggestion string → ClosetItem | null | false.
   * null = LLM found no match (local scoring runs as safety net).
   * false = rematch exhausted all candidates (no fallback).
   */
  matchMap?: Record<string, ClosetItem | null | false>;
  /** Called when thumbs-up is given for a specific matched item. */
  onMatchThumbsUp?: (suggestion: string, matchedItemId: string) => void;
  /** Called when thumbs-down is given for a specific matched item, triggering rematch. */
  onMatchThumbsDown?: (suggestion: string, matchedItemId: string) => void;
  /** Persisted per-suggestion feedback: suggestion → 'up' | 'down' | null. */
  matchFeedbackMap?: Record<string, 'up' | 'down' | null>;
  /** Suggestions currently being rematched — shows a loading indicator on that piece row. */
  regeneratingMatches?: Set<string>;
  /** User-provided anchor item description — shown first in the pieces list, never closet-matched. */
  anchorDescription?: string;
  /** Persisted outfit-level feedback for this tier. */
  outfitFeedback?: 'love' | 'hate' | null;
  /** Called when the user taps Love it or Hate it. */
  onOutfitFeedback?: (thumb: 'love' | 'hate') => void;
};

// ── View ───────────────────────────────────────────────────────────────────────

export function LookResultCardView({
  recommendation,
  detailHref,
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
  anchorDescription,
  outfitFeedback,
  onOutfitFeedback,
}: LookResultCardViewProps) {
  const { theme } = useTheme();
  const { labeledPieces, hasAnyMatch, matchedPiece, setMatchedPiece } = useLookResultCard({
    recommendation,
    closetItems,
    matchMap,
    anchorDescription,
  });

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

      <TierPieceListView
        labeledPieces={labeledPieces}
        hasAnyMatch={hasAnyMatch}
        regeneratingMatches={regeneratingMatches}
        onPiecePress={(item, suggestion, confidencePercent) =>
          setMatchedPiece({ item, suggestion, confidencePercent })
        }
      />

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

      <CardSection title="Fit notes" items={recommendation.fitNotes} />

      <View style={{ gap: spacing.xs }}>
        <AppText variant="sectionTitle">Why it works</AppText>
        <AppText tone="muted">{recommendation.whyItWorks}</AppText>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Link href={detailHref} asChild>
          <Pressable
            style={[
              actionButtonStyle,
              {
                backgroundColor: theme.colors.text,
                flex: undefined,
                flexDirection: 'row',
                gap: spacing.xs,
                width: '100%',
              },
            ]}>
            <Ionicons color={theme.colors.background} name="checkmark-circle-outline" size={18} />
            <AppText style={{ color: theme.colors.background }}>Check Look</AppText>
          </Pressable>
        </Link>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {(['love', 'hate'] as const).map((thumb) => {
            const isSelected = outfitFeedback === thumb;
            return (
              <Pressable
                key={thumb}
                onPress={() => onOutfitFeedback?.(thumb)}
                style={[
                  actionButtonStyle,
                  {
                    backgroundColor: isSelected ? theme.colors.text : 'transparent',
                    borderColor: isSelected ? theme.colors.text : theme.colors.border,
                    flexDirection: 'row',
                    gap: spacing.xs,
                  },
                ]}>
                <Ionicons
                  color={isSelected ? theme.colors.background : theme.colors.mutedText}
                  name={thumb === 'love' ? 'heart-outline' : 'thumbs-down-outline'}
                  size={16}
                />
                <AppText style={{ color: isSelected ? theme.colors.background : theme.colors.mutedText }}>
                  {thumb === 'love' ? 'Love it' : 'Hate it'}
                </AppText>
              </Pressable>
            );
          })}
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
      </View>

      {/* Bottom sheet shown when user taps a checkmark — includes per-match feedback */}
      {matchedPiece ? (() => {
        // Derive the current item live from labeledPieces so the sheet auto-updates after rematch
        const currentItem = labeledPieces.find(p => p.value === matchedPiece.suggestion)?.matchedClosetItem ?? null;
        const isRematching = regeneratingMatches?.has(matchedPiece.suggestion) ?? false;
        return (
          <ClosetItemSheet
            item={currentItem}
            suggestion={matchedPiece.suggestion}
            isRematching={isRematching}
            thumbsFeedback={matchFeedbackMap?.[matchedPiece.suggestion] ?? null}
            confidencePercent={matchedPiece.confidencePercent}
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

// ── Private sub-components ─────────────────────────────────────────────────────

function TierSketch({ recommendation }: { recommendation: LookRecommendation }) {
  const { theme } = useTheme();
  if (recommendation.sketchStatus === 'ready' && recommendation.sketchImageUrl) {
    return (
      <RemoteImagePanel
        uri={recommendation.sketchImageUrl}
        aspectRatio={1}
        minHeight={280}
        resizeMode="contain"
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
  const { theme } = useTheme();
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
