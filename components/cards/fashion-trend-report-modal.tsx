import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { FullscreenNavArrows } from '@/components/ui/fullscreen-nav-arrows';
import { spacing, theme } from '@/constants/theme';
import { formatTierLabel } from '@/lib/outfit-utils';
import type { SeasonalColorEntry, SeasonalTrendReportEntry, TrendFeedbackValue } from '@/types/api';

type FashionTrendReportModalProps = {
  visible: boolean;
  isLoading: boolean;
  isGenerating: boolean;
  trends: SeasonalTrendReportEntry[] | null;
  isStale: boolean;
  error: string | null;
  onClose: () => void;
  /** Sets (feedback) or clears (null) this user's personal thumbs up/down on a trend. */
  onSetTrendFeedback: (trendName: string, feedback: TrendFeedbackValue | null) => void;
  isLoadingColors: boolean;
  isGeneratingColors: boolean;
  colors: SeasonalColorEntry[] | null;
  colorsError: string | null;
  /** Sets (feedback) or clears (null) this user's personal thumbs up/down on a colour. */
  onSetColorFeedback: (colorName: string, feedback: TrendFeedbackValue | null) => void;
};

// Only kind + name are stored — the url and index are always looked up live
// against the current trends/colors arrays (see viewableTrends/viewableColors
// below), so prev/next and the feedback thumbs all reflect the latest state.
type FullscreenItem = { kind: 'trend' | 'color'; name: string };

const LIFECYCLE_LABEL: Record<SeasonalTrendReportEntry['lifecycle'], string> = {
  emerging: 'Emerging',
  current: 'Current',
  established: 'Established',
  declining: 'Declining',
};

export function FashionTrendReportModal({
  visible, isLoading, isGenerating, trends, isStale, error, onClose, onSetTrendFeedback,
  isLoadingColors, isGeneratingColors, colors, colorsError, onSetColorFeedback,
}: FashionTrendReportModalProps) {
  const insets = useSafeAreaInsets();
  const [fullscreenItem, setFullscreenItem] = useState<FullscreenItem | null>(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  // Only sketches that are actually viewable belong in the prev/next cycle —
  // skipping straight over any still-pending or failed entries.
  const viewableTrends = trends?.filter((t) => t.sketchStatus === 'ready' && !!t.sketchImageUrl) ?? [];
  const viewableColors = colors?.filter((c) => c.sketchStatus === 'ready' && !!c.sketchImageUrl) ?? [];
  const activeList: { name: string; sketchImageUrl: string | null }[] =
    fullscreenItem?.kind === 'trend' ? viewableTrends : fullscreenItem?.kind === 'color' ? viewableColors : [];
  const activeIndex = fullscreenItem ? activeList.findIndex((item) => item.name === fullscreenItem.name) : -1;
  const activeEntry = activeIndex >= 0 ? activeList[activeIndex] : null;

  // Always looked up live from the current trends/colors arrays (rather than
  // snapshotted into fullscreenItem) so the fullscreen thumbs reflect the
  // latest state immediately after tapping them.
  const fullscreenFeedback =
    fullscreenItem?.kind === 'trend'
      ? trends?.find((t) => t.name === fullscreenItem.name)?.userFeedback ?? null
      : fullscreenItem?.kind === 'color'
        ? colors?.find((c) => c.name === fullscreenItem.name)?.userFeedback ?? null
        : null;

  function handleFullscreenFeedback(feedback: TrendFeedbackValue | null) {
    if (!fullscreenItem) return;
    if (fullscreenItem.kind === 'trend') onSetTrendFeedback(fullscreenItem.name, feedback);
    else onSetColorFeedback(fullscreenItem.name, feedback);
  }

  function goToFullscreenOffset(offset: number) {
    if (!fullscreenItem || activeIndex < 0) return;
    const nextEntry = activeList[activeIndex + offset];
    if (!nextEntry) return;
    setFullscreenItem({ kind: fullscreenItem.kind, name: nextEntry.name });
  }

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
        <View
          style={{
            alignItems: 'flex-start',
            flexDirection: 'row',
            gap: spacing.sm,
            justifyContent: 'space-between',
            // Modal content renders outside the normal safe-area tree on iOS, so
            // insets.top can read as 0 here even though content draws under the
            // status bar — fall back to a fixed clearance if insets look unset.
            paddingTop: Math.max(insets.top, 50) + spacing.lg,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.md,
          }}>
          <View style={{ alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.xs }}>
            <AppText variant="heroSmall">Fashion Trend Report</AppText>
            <Pressable hitSlop={10} onPress={() => setIsInfoOpen(true)}>
              <AppIcon color={theme.colors.mutedText} name="info" size={18} />
            </Pressable>
          </View>
          <Pressable hitSlop={12} onPress={onClose}>
            <AppIcon color={theme.colors.subtleText} name="close" size={24} />
          </Pressable>
        </View>

        {isLoading ? (
          <View style={{ alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center', paddingHorizontal: spacing.lg }}>
            <ActivityIndicator color={theme.colors.accent} />
            {isGenerating ? (
              <AppText tone="muted" style={{ textAlign: 'center', fontSize: 13 }}>
                Putting this season&apos;s report together — this can take a few seconds.
              </AppText>
            ) : null}
          </View>
        ) : error || !trends ? (
          <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg }}>
            <AppText tone="muted" style={{ textAlign: 'center' }}>{error ?? 'No trend report available yet.'}</AppText>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.md, padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
            <ColorPaletteSection
              isLoading={isLoadingColors}
              isGenerating={isGeneratingColors}
              colors={colors}
              error={colorsError}
              onSelectSketch={(name) => setFullscreenItem({ kind: 'color', name })}
            />
            {isStale ? (
              <AppText tone="subtle" style={{ fontSize: 12, fontStyle: 'italic' }}>
                Showing last season&apos;s report while this season&apos;s is being refreshed.
              </AppText>
            ) : null}
            {trends.map((trend, index) => {
              const showSectionHeader = index === 0 || trends[index - 1]!.formality !== trend.formality;
              return (
                <View key={`${trend.name}-${index}`} style={{ gap: spacing.md }}>
                  {showSectionHeader ? (
                    <AppText
                      variant="eyebrow"
                      style={{
                        color: theme.colors.mutedText,
                        letterSpacing: 1.8,
                        marginTop: index > 0 ? spacing.xs : 0,
                      }}>
                      {formatTierLabel(trend.formality)}
                    </AppText>
                  ) : null}
                  <TrendRow
                    trend={trend}
                    showDivider={!showSectionHeader}
                    onSelectSketch={(name) => setFullscreenItem({ kind: 'trend', name })}
                    onSetFeedback={(feedback) => onSetTrendFeedback(trend.name, feedback)}
                  />
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={fullscreenItem !== null}
        onRequestClose={() => setFullscreenItem(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' }}>
          <Pressable
            hitSlop={12}
            onPress={() => setFullscreenItem(null)}
            style={{
              alignSelf: 'flex-end',
              // Modal content renders outside the normal safe-area tree on iOS, so
              // insets.top can read as 0 here even though the modal draws under the
              // status bar — fall back to a fixed clearance if insets look unset.
              paddingTop: Math.max(insets.top, 50) + spacing.sm,
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.sm,
            }}>
            <AppIcon color="#fff" name="close" size={28} />
          </Pressable>
          {fullscreenItem && activeEntry ? (
            <>
              <View style={{ flex: 1 }}>
                <Image contentFit="contain" source={{ uri: activeEntry.sketchImageUrl! }} style={{ flex: 1, width: '100%' }} />
                <FullscreenNavArrows
                  canGoPrev={activeIndex > 0}
                  canGoNext={activeIndex >= 0 && activeIndex < activeList.length - 1}
                  onPrev={() => goToFullscreenOffset(-1)}
                  onNext={() => goToFullscreenOffset(1)}
                />
              </View>
              <View style={{ alignItems: 'center', gap: spacing.md, paddingBottom: insets.bottom + spacing.lg, paddingHorizontal: spacing.lg }}>
                <AppText style={{ color: '#fff', fontSize: 15, textAlign: 'center' }}>
                  {activeEntry.name}
                </AppText>
                <FullscreenFeedbackButtons feedback={fullscreenFeedback} onSetFeedback={handleFullscreenFeedback} />
              </View>
            </>
          ) : null}
        </View>
      </Modal>

      <InfoModal visible={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
    </Modal>
  );
}

/** Explains what the report shows and what the thumbs do — mirrors GenerateOutfitsModal's sheet style. */
function InfoModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          alignItems: 'center',
          backgroundColor: 'rgba(24, 18, 14, 0.5)',
          flex: 1,
          justifyContent: 'center',
          padding: spacing.lg,
        }}>
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: 28,
            maxWidth: 440,
            width: '100%',
          }}>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg }}>
            <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText variant="sectionTitle">About this report</AppText>
              <Pressable hitSlop={8} onPress={onClose}>
                <AppIcon color={theme.colors.mutedText} name="close" size={22} />
              </Pressable>
            </View>

            <View style={{ gap: spacing.sm }}>
              <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 14 }}>Season&apos;s Hottest Colors</AppText>
              <AppText tone="muted" style={{ fontSize: 13, lineHeight: 19 }}>
                The season&apos;s most significant colours, generated once per season and shared by every Vesture user. A colour marked
                &quot;Best for you&quot; is a genuine colour-analysis match for your own skin tone.
              </AppText>
            </View>

            <View style={{ gap: spacing.sm }}>
              <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 14 }}>Trends</AppText>
              <AppText tone="muted" style={{ fontSize: 13, lineHeight: 19 }}>
                This season&apos;s most influential trends across Business, Smart Casual, and Casual dressing, each illustrated with a
                single hero piece.
              </AppText>
            </View>

            <View style={{ gap: spacing.sm }}>
              <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 14 }}>The thumbs</AppText>
              <AppText tone="muted" style={{ fontSize: 13, lineHeight: 19 }}>
                Tap thumbs up or down on any trend or colour to set your own personal bias — private to you, never shared. A thumbs up
                slightly favours that pick the next time we generate outfits for you; a thumbs down slightly avoids it. Tap an
                already-set thumb again to clear it back to neutral.
              </AppText>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TrendRow({
  trend,
  showDivider,
  onSelectSketch,
  onSetFeedback,
}: {
  trend: SeasonalTrendReportEntry;
  showDivider: boolean;
  onSelectSketch: (name: string) => void;
  onSetFeedback: (feedback: TrendFeedbackValue | null) => void;
}) {
  const isDirectional = trend.lifecycle === 'emerging' || trend.lifecycle === 'current';
  const isSketchReady = trend.sketchStatus === 'ready' && !!trend.sketchImageUrl;

  const thumbnail = (
    <View style={{ backgroundColor: theme.colors.card, borderRadius: 12, height: 88, overflow: 'hidden', width: 66 }}>
      {isSketchReady ? (
        <Image contentFit="cover" source={{ uri: trend.sketchImageUrl! }} style={{ height: '100%', width: '100%' }} />
      ) : trend.sketchStatus === 'pending' || trend.sketchStatus === null ? (
        <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.subtleText} size="small" />
        </View>
      ) : (
        <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          <AppIcon color={theme.colors.subtleText} name="sparkles" size={18} />
        </View>
      )}
    </View>
  );

  return (
    <View
      style={{
        borderTopColor: theme.colors.border,
        borderTopWidth: showDivider ? 1 : 0,
        flexDirection: 'row',
        gap: spacing.sm,
        paddingTop: showDivider ? spacing.md : 0,
      }}>
      {isSketchReady ? (
        <Pressable onPress={() => onSelectSketch(trend.name)}>{thumbnail}</Pressable>
      ) : (
        thumbnail
      )}

      <View style={{ flex: 1, gap: spacing.xs }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' }}>
          <AppText style={{ flex: 1, fontFamily: theme.fonts.sansMedium, fontSize: 15 }}>{trend.name}</AppText>
          <View
            style={{
              backgroundColor: isDirectional ? theme.colors.accent : theme.colors.subtleSurface,
              borderRadius: 999,
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
            }}>
            <AppText
              variant="eyebrow"
              style={{
                color: isDirectional ? theme.colors.inverseText : theme.colors.mutedText,
                fontSize: 10,
                letterSpacing: 1,
              }}>
              {LIFECYCLE_LABEL[trend.lifecycle]}
            </AppText>
          </View>
        </View>
        <AppText tone="muted" style={{ fontSize: 13 }}>{trend.summary}</AppText>
      </View>

      <FeedbackButtons feedback={trend.userFeedback} onSetFeedback={onSetFeedback} />
    </View>
  );
}

/** Personal thumbs up/down on a trend — tapping an already-selected thumb clears it back to neutral. */
function FeedbackButtons({
  feedback,
  onSetFeedback,
}: {
  feedback: TrendFeedbackValue | null;
  onSetFeedback: (feedback: TrendFeedbackValue | null) => void;
}) {
  return (
    <View style={{ gap: spacing.xs, justifyContent: 'center' }}>
      <Pressable
        hitSlop={8}
        onPress={() => onSetFeedback(feedback === 'up' ? null : 'up')}
        style={{
          alignItems: 'center',
          backgroundColor: feedback === 'up' ? theme.colors.card : 'transparent',
          borderColor: feedback === 'up' ? theme.colors.accent : theme.colors.border,
          borderRadius: 999,
          borderWidth: 1,
          padding: spacing.xs,
        }}>
        <AppIcon color={feedback === 'up' ? theme.colors.accent : theme.colors.mutedText} name="thumbs-up" size={14} />
      </Pressable>
      <Pressable
        hitSlop={8}
        onPress={() => onSetFeedback(feedback === 'down' ? null : 'down')}
        style={{
          alignItems: 'center',
          backgroundColor: feedback === 'down' ? theme.colors.dangerSurface : 'transparent',
          borderColor: feedback === 'down' ? theme.colors.danger : theme.colors.border,
          borderRadius: 999,
          borderWidth: 1,
          padding: spacing.xs,
        }}>
        <AppIcon color={feedback === 'down' ? theme.colors.danger : theme.colors.mutedText} name="thumbs-down" size={14} />
      </Pressable>
    </View>
  );
}

/** Same thumbs up/down, styled for the black fullscreen viewer — horizontal, larger, light on dark. */
function FullscreenFeedbackButtons({
  feedback,
  onSetFeedback,
}: {
  feedback: TrendFeedbackValue | null;
  onSetFeedback: (feedback: TrendFeedbackValue | null) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <Pressable
        hitSlop={10}
        onPress={() => onSetFeedback(feedback === 'up' ? null : 'up')}
        style={{
          alignItems: 'center',
          backgroundColor: feedback === 'up' ? 'rgba(255,255,255,0.16)' : 'transparent',
          borderColor: feedback === 'up' ? '#fff' : 'rgba(255,255,255,0.4)',
          borderRadius: 999,
          borderWidth: 1,
          padding: spacing.sm,
        }}>
        <AppIcon color="#fff" name="thumbs-up" size={20} />
      </Pressable>
      <Pressable
        hitSlop={10}
        onPress={() => onSetFeedback(feedback === 'down' ? null : 'down')}
        style={{
          alignItems: 'center',
          backgroundColor: feedback === 'down' ? 'rgba(255,255,255,0.16)' : 'transparent',
          borderColor: feedback === 'down' ? '#fff' : 'rgba(255,255,255,0.4)',
          borderRadius: 999,
          borderWidth: 1,
          padding: spacing.sm,
        }}>
        <AppIcon color="#fff" name="thumbs-down" size={20} />
      </Pressable>
    </View>
  );
}

/** "This Season's Hottest Colors" — a horizontal swatch row atop the report. Loads independently of the trend list below it. */
function ColorPaletteSection({
  isLoading,
  isGenerating,
  colors,
  error,
  onSelectSketch,
}: {
  isLoading: boolean;
  isGenerating: boolean;
  colors: SeasonalColorEntry[] | null;
  error: string | null;
  onSelectSketch: (name: string) => void;
}) {
  if (isLoading) {
    return (
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <ActivityIndicator color={theme.colors.accent} size="small" />
        {isGenerating ? (
          <AppText tone="muted" style={{ fontSize: 12, textAlign: 'center' }}>Putting this season&apos;s colours together...</AppText>
        ) : null}
      </View>
    );
  }

  if (error || !colors) {
    return null; // Non-critical section — fail quietly rather than block the rest of the report.
  }

  return <ColorSwatchRow colors={colors} onSelectSketch={onSelectSketch} />;
}

// Rough threshold for "probably more than fits on one screen" — good enough
// to decide whether the scroll hint is worth showing at all; exact per-device
// fit doesn't matter since the hint disappears the moment the user scrolls.
const COLOR_ROW_SCROLL_HINT_THRESHOLD = 4;

function ColorSwatchRow({
  colors,
  onSelectSketch,
}: {
  colors: SeasonalColorEntry[];
  onSelectSketch: (name: string) => void;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
        Season&apos;s Hottest Colors
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.md }}>
        {colors.map((color) => (
          <ColorSwatchCard key={color.name} color={color} onSelectSketch={onSelectSketch} />
        ))}
      </ScrollView>
      {colors.length > COLOR_ROW_SCROLL_HINT_THRESHOLD ? (
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 2, justifyContent: 'flex-end' }}>
          <AppText tone="subtle" style={{ fontSize: 11 }}>Scroll for more</AppText>
          <AppIcon color={theme.colors.subtleText} name="chevron-right" size={12} />
        </View>
      ) : null}
    </View>
  );
}

function ColorSwatchCard({
  color,
  onSelectSketch,
}: {
  color: SeasonalColorEntry;
  onSelectSketch: (name: string) => void;
}) {
  const isSketchReady = color.sketchStatus === 'ready' && !!color.sketchImageUrl;

  const swatch = (
    <View
      style={{
        backgroundColor: color.hex,
        borderColor: color.bestSuitedForUser ? theme.colors.accent : theme.colors.border,
        borderRadius: 14,
        borderWidth: color.bestSuitedForUser ? 2 : 1,
        height: 84,
        overflow: 'hidden',
        width: 84,
      }}>
      {isSketchReady ? (
        <Image contentFit="cover" source={{ uri: color.sketchImageUrl! }} style={{ height: '100%', width: '100%' }} />
      ) : color.sketchStatus === 'pending' || color.sketchStatus === null ? (
        <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color="#fff" size="small" />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ gap: 4, width: 84 }}>
      {isSketchReady ? (
        <Pressable onPress={() => onSelectSketch(color.name)}>{swatch}</Pressable>
      ) : (
        swatch
      )}
      <AppText style={{ fontSize: 12, fontFamily: theme.fonts.sansMedium }} numberOfLines={2}>
        {color.name}
      </AppText>
      {color.bestSuitedForUser ? (
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 3 }}>
          <AppIcon color={theme.colors.accent} name="sparkles" size={10} />
          <AppText style={{ color: theme.colors.accent, fontSize: 10, fontFamily: theme.fonts.sansMedium }} numberOfLines={1}>
            Best for you
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
