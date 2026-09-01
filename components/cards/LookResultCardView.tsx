import { Href, router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { GeneratedSketchPanel } from '@/components/generated/GeneratedSketchPanel';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { formatTierLabel } from '@/lib/outfit-utils';
import type { LookRecommendation } from '@/types/look-request';
import type { ClosetItem } from '@/types/closet';
import { AppText } from '@/components/ui/app-text';
import { OutfitPieceListView } from './OutfitPieceListView';
import { buildLabeledPieces } from './look-result-card-helpers';

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
  const labeledPieces = useMemo(
    () => buildLabeledPieces(recommendation, closetItems, matchMap, anchorDescription),
    [recommendation, closetItems, matchMap, anchorDescription],
  );

  const nonAnchorPieces = labeledPieces.filter((p) => !p.isAnchor);
  const ownedCount = nonAnchorPieces.filter((p) => p.matchedClosetItem).length;

  const quietButtonStyle = {
    alignItems: 'center',
    backgroundColor: theme.colors.subtleSurface,
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: spacing.md,
  } as const;

  const primaryButtonStyle = {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: spacing.md,
  } as const;

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 28,
        borderWidth: 1,
        overflow: 'hidden',
      }}>
      {/* Editorial header — category eyebrow + the outfit's own name as the headline */}
      <View style={{ gap: 2, paddingBottom: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        <AppText variant="eyebrow" style={{ color: theme.colors.accent }}>
          {formatTierLabel(recommendation.tier)}
        </AppText>
        <AppText variant="display">{recommendation.title}</AppText>
      </View>

      {/* Illustration — edge to edge, no inner framing */}
      <GeneratedSketchPanel
        status={recommendation.sketchStatus}
        imageUrl={recommendation.sketchImageUrl}
        borderRadius={0}
      />

      {/* Love / Not for me — sits directly below the image, not floating over it */}
      <View style={{ alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <View style={{ backgroundColor: theme.colors.subtleSurface, borderRadius: 999, flexDirection: 'row', overflow: 'hidden' }}>
          {(['love', 'hate'] as const).map((thumb, index) => {
            const isSelected = outfitFeedback === thumb;
            return (
              <Pressable
                key={thumb}
                onPress={() => onOutfitFeedback?.(thumb)}
                style={{
                  alignItems: 'center',
                  borderLeftColor: index === 1 ? theme.colors.border : undefined,
                  borderLeftWidth: index === 1 ? 1 : 0,
                  flexDirection: 'row',
                  gap: spacing.xs,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm + 2,
                }}>
                <AppIcon
                  color={isSelected ? theme.colors.accent : theme.colors.text}
                  name={thumb === 'love' ? 'heart' : 'thumbs-down'}
                  size={16}
                />
                <AppText style={{ color: isSelected ? theme.colors.accent : theme.colors.text, fontSize: 13 }}>
                  {thumb === 'love' ? 'Love this' : 'Not for me'}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: spacing.lg, padding: spacing.lg }}>
        {/* Stylist rationale — comes before the itemized breakdown, matching how a stylist actually explains a look */}
        <View style={{ gap: spacing.xs }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText }}>Why This Works</AppText>
          <AppText tone="muted">{recommendation.whyItWorks}</AppText>
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText }}>The Look</AppText>
          <OutfitPieceListView
            pieces={labeledPieces}
            display="labeled"
            regeneratingMatches={regeneratingMatches}
            matchFeedbackMap={matchFeedbackMap}
            onMatchThumbsUp={onMatchThumbsUp}
            onMatchThumbsDown={onMatchThumbsDown}
          />
          {nonAnchorPieces.length > 0 ? (
            <AppText tone="subtle" style={{ fontSize: 12 }}>
              You own {ownedCount} of {nonAnchorPieces.length} pieces
            </AppText>
          ) : null}
        </View>

        {recommendation.fitNotes.length > 0 ? (
          <View style={{ gap: spacing.xs }}>
            <AppText variant="eyebrow" style={{ color: theme.colors.mutedText }}>Fit Notes</AppText>
            {recommendation.fitNotes.map((note) => (
              <AppText key={note} tone="muted">• {note}</AppText>
            ))}
          </View>
        ) : null}

        {/* Quieter, lower-emphasis actions — these support the look, they aren't the point of the card */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable
            disabled={isSaved || isSaving || !onSave}
            onPress={onSave}
            style={[quietButtonStyle, isSaved ? { backgroundColor: theme.colors.border } : null]}>
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
              <AppIcon color={theme.colors.text} name="bookmark" size={16} />
              <AppText style={{ fontSize: 13 }}>{isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Save outfit'}</AppText>
            </View>
          </Pressable>
          <Pressable disabled={!onAddToWeek} onPress={onAddToWeek} style={quietButtonStyle}>
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
              <AppIcon color={theme.colors.text} name="calendar" size={16} />
              <AppText style={{ fontSize: 13 }}>Add to week</AppText>
            </View>
          </Pressable>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Pressable
            onPress={() => router.push(detailHref)}
            style={[primaryButtonStyle, { backgroundColor: theme.colors.text, flexDirection: 'row', gap: spacing.xs }]}>
            <AppIcon color={theme.colors.inverseText} name="check-circle" size={18} />
            <AppText style={{ color: theme.colors.inverseText }}>Check Look</AppText>
          </Pressable>

          <Pressable
            onPress={onSecondOpinion}
            style={[
              primaryButtonStyle,
              { borderColor: theme.colors.accent, borderWidth: 1, flexDirection: 'row', gap: spacing.xs },
            ]}>
            <AppIcon color={theme.colors.accent} name="chat" size={18} />
            <AppText style={{ color: theme.colors.accent }}>Second Opinion</AppText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
