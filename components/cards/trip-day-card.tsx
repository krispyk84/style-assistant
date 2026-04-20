import { ActivityIndicator, Animated, Image, LayoutAnimation, Platform, Pressable, UIManager, View } from 'react-native';
import { useEffect, useMemo, useRef } from 'react';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { findBestClosetMatch } from '@/lib/closet-match';
import type { TripOutfitDay } from '@/services/trip-outfits';
import type { ClosetItem } from '@/types/closet';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// ── Day type badge ────────────────────────────────────────────────────────────

const DAY_TYPE_LABELS: Record<TripOutfitDay['dayType'], string> = {
  travel_day:    'Travel',
  sightseeing:   'Sightseeing',
  business:      'Business',
  meeting:       'Meeting',
  dinner_out:    'Dinner',
  beach_pool:    'Beach / Pool',
  adventure:     'Adventure',
  wedding_event: 'Event',
  relaxed:       'Relaxed',
  conference:    'Conference',
};

// ── Outfit section grouping ───────────────────────────────────────────────────

type OutfitGroup = { label: string; items: string[] };

const OUTERWEAR_KEYWORDS = ['jacket', 'coat', 'blazer', 'cardigan', 'hoodie', 'windbreaker', 'parka', 'vest', 'puffer', 'trench', 'overcoat', 'jumper'];
const TOP_KEYWORDS = ['shirt', 'tee', 't-shirt', 'blouse', 'top', 'sweater', 'polo', 'tank', 'turtleneck', 'henley', 'pullover'];
const BOTTOM_KEYWORDS = ['trouser', 'trousers', 'jeans', 'shorts', 'skirt', 'chino', 'chinos', 'legging', 'leggings', 'jogger', 'joggers', 'pant', 'pants', 'culottes', 'midi', 'maxi'];
const DRESS_KEYWORDS = ['dress', 'jumpsuit', 'romper', 'overalls'];
const SWIM_KEYWORDS = ['swimsuit', 'bikini', 'boardshort', 'swim trunks', 'one-piece', 'swimwear', 'wetsuit'];

function categorizePiece(piece: string): string {
  const lower = piece.toLowerCase();
  if (SWIM_KEYWORDS.some((k) => lower.includes(k))) return 'Swimwear';
  if (OUTERWEAR_KEYWORDS.some((k) => lower.includes(k))) return 'Outerwear';
  if (DRESS_KEYWORDS.some((k) => lower.includes(k))) return 'Dress / Jumpsuit';
  if (TOP_KEYWORDS.some((k) => lower.includes(k))) return 'Top';
  if (BOTTOM_KEYWORDS.some((k) => lower.includes(k))) return 'Bottom';
  return 'Top'; // fallback
}

function buildOutfitGroups(day: TripOutfitDay): OutfitGroup[] {
  const groupMap: Record<string, string[]> = {};

  for (const piece of (day.pieces ?? [])) {
    if (!piece) continue;
    const cat = categorizePiece(piece);
    (groupMap[cat] ??= []).push(piece);
  }

  const groups: OutfitGroup[] = [];
  for (const label of ['Swimwear', 'Outerwear', 'Dress / Jumpsuit', 'Top', 'Bottom']) {
    if (groupMap[label]?.length) groups.push({ label, items: groupMap[label]! });
  }

  if (day.shoes) groups.push({ label: 'Shoes', items: [day.shoes] });
  if (day.bag) groups.push({ label: 'Bag', items: [day.bag] });
  if ((day.accessories ?? []).length) groups.push({ label: 'Accessories', items: day.accessories });

  return groups;
}

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  day: TripOutfitDay;
  closetItems?: ClosetItem[];
  isRegenerating: boolean;
  onGenerateSketch: () => void;
  onLove: () => void;
  onHate: () => void;
};

export function TripDayCard({ day, closetItems, isRegenerating, onGenerateSketch, onLove, onHate }: Props) {
  const { theme } = useTheme();

  const dayLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const hasSketch = day.sketchStatus === 'ready' && !!day.sketchUrl;
  const isSketchLoading = day.sketchStatus === 'loading';
  const sketchFailed = day.sketchStatus === 'failed';

  const isLoved = day.feedback === 'love';
  const isHated = day.feedback === 'hate';

  const outfitGroups = buildOutfitGroups(day);

  // Pre-compute which items have a closet match (keyed by item string)
  const closetMatches = useMemo(() => {
    if (!closetItems?.length) return new Set<string>();
    const matched = new Set<string>();
    for (const piece of (day.pieces ?? [])) {
      if (piece && findBestClosetMatch(piece, closetItems)) matched.add(piece);
    }
    if (day.shoes && findBestClosetMatch(day.shoes, closetItems)) matched.add(day.shoes);
    if (day.bag && findBestClosetMatch(day.bag, closetItems)) matched.add(day.bag);
    for (const acc of (day.accessories ?? [])) {
      if (acc && findBestClosetMatch(acc, closetItems)) matched.add(acc);
    }
    return matched;
  }, [day.pieces, day.shoes, day.bag, day.accessories, closetItems]);

  // Animate layout when sketch becomes ready so the card expands smoothly.
  const prevHasSketch = useRef(hasSketch);
  useEffect(() => {
    if (!prevHasSketch.current && hasSketch) {
      LayoutAnimation.configureNext(
        LayoutAnimation.create(320, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
      );
    }
    prevHasSketch.current = hasSketch;
  }, [hasSketch]);

  // Looping progress bar for regeneration state
  const regenAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isRegenerating) { regenAnim.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(regenAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(regenAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isRegenerating, regenAnim]);

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 24,
        borderWidth: 1,
        overflow: 'hidden',
      }}>

      {/* ── Sketch area: three explicit height states ─────────────────────── */}
      {hasSketch ? (
        // ── Ready: full aspect-ratio image, same as standard outfit card ──
        <Image
          source={{ uri: day.sketchUrl! }}
          style={{ width: '100%', aspectRatio: 1024 / 1536 }}
          resizeMode="cover"
        />
      ) : isRegenerating ? (
        // ── Regenerating: animated loading bar ───────────────────────────────
        <View
          style={{
            width: '100%',
            height: 80,
            backgroundColor: theme.colors.subtleSurface,
            justifyContent: 'center',
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
          }}>
          <AppText style={{ color: theme.colors.mutedText, fontSize: 12, textAlign: 'center' }}>
            Finding a new outfit…
          </AppText>
          <View style={{ height: 3, backgroundColor: theme.colors.border, borderRadius: 999, overflow: 'hidden' }}>
            <Animated.View
              style={{
                height: '100%',
                width: '40%',
                backgroundColor: theme.colors.accent,
                borderRadius: 999,
                transform: [{
                  translateX: regenAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-80, 260],
                  }),
                }],
              }}
            />
          </View>
        </View>
      ) : isSketchLoading ? (
        // ── Sketch loading: compact spinner ──────────────────────────────────
        <View
          style={{
            width: '100%',
            height: 80,
            backgroundColor: theme.colors.subtleSurface,
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.xs,
          }}>
          <ActivityIndicator color={theme.colors.subtleText} size="small" />
          <AppText style={{ color: theme.colors.mutedText, fontSize: 12 }}>
            Generating sketch…
          </AppText>
        </View>
      ) : (
        // ── Idle / failed: compact action strip (icon + label + CTA) ────────
        <View
          style={{
            width: '100%',
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing.lg,
            backgroundColor: theme.colors.subtleSurface,
            alignItems: 'center',
            gap: spacing.sm,
          }}>
          <AppIcon name="sparkles" color={theme.colors.subtleText} size={22} />
          <AppText style={{ color: theme.colors.mutedText, fontSize: 12, textAlign: 'center' }}>
            {sketchFailed ? 'Sketch failed. Try again.' : 'No sketch yet'}
          </AppText>
          <Pressable
            onPress={onGenerateSketch}
            style={{
              backgroundColor: theme.colors.text,
              borderRadius: 999,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
            }}>
            <AppText
              style={{
                color: theme.colors.inverseText,
                fontFamily: theme.fonts.sansMedium,
                fontSize: 11,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}>
              {sketchFailed ? 'Retry Sketch' : 'Generate Sketch'}
            </AppText>
          </Pressable>
        </View>
      )}

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <View style={{ gap: spacing.md, padding: spacing.lg }}>

        {/* Day header */}
        <View style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText style={{ color: theme.colors.mutedText, fontFamily: theme.fonts.sansMedium, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' }}>
              {dayLabel}
            </AppText>
            <View
              style={{
                backgroundColor: theme.colors.subtleSurface,
                borderRadius: 999,
                paddingHorizontal: spacing.sm,
                paddingVertical: 3,
              }}>
              <AppText style={{ color: theme.colors.mutedText, fontSize: 11, fontFamily: theme.fonts.sansMedium }}>
                {DAY_TYPE_LABELS[day.dayType] ?? day.dayType}
              </AppText>
            </View>
          </View>
          <AppText variant="sectionTitle">{day.title}</AppText>
          <AppText tone="muted" style={{ fontSize: 13, lineHeight: 19 }}>{day.rationale}</AppText>
        </View>

        {/* Outfit groups */}
        <View style={{ gap: spacing.sm }}>
          {outfitGroups.map((group) => (
            <View key={group.label}>
              <AppText style={{ color: theme.colors.mutedText, fontFamily: theme.fonts.sansMedium, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
                {group.label}
              </AppText>
              {group.items.map((item, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs }}>
                  <AppText style={{ color: theme.colors.accent, fontSize: 13, lineHeight: 20 }}>·</AppText>
                  <AppText style={{ flex: 1, fontSize: 13, lineHeight: 20 }}>{item}</AppText>
                  {closetMatches.has(item) && (
                    <AppIcon name="check-circle" color={theme.colors.accent} size={13} style={{ marginTop: 3 }} />
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Context tags */}
        {(day.contextTags ?? []).length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {day.contextTags.map((tag) => (
              <View
                key={tag}
                style={{
                  backgroundColor: theme.colors.subtleSurface,
                  borderRadius: 999,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 3,
                }}>
                <AppText style={{ color: theme.colors.mutedText, fontSize: 11 }}>{tag}</AppText>
              </View>
            ))}
          </View>
        )}

        {/* ── Actions row ──────────────────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs }}>

          {/* Love / Hate */}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable
              onPress={onLove}
              disabled={isRegenerating}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: isLoved ? theme.colors.text : theme.colors.subtleSurface,
                borderRadius: 999,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs + 1,
              }}>
              <AppIcon
                name="heart"
                color={isLoved ? theme.colors.inverseText : theme.colors.subtleText}
                size={13}
              />
              <AppText style={{
                color: isLoved ? theme.colors.inverseText : theme.colors.subtleText,
                fontFamily: theme.fonts.sansMedium,
                fontSize: 12,
              }}>
                Love it
              </AppText>
            </Pressable>

            <Pressable
              onPress={onHate}
              disabled={isRegenerating}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: isHated ? theme.colors.text : theme.colors.subtleSurface,
                borderRadius: 999,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs + 1,
              }}>
              <AppIcon
                name="thumbs-down"
                color={isHated ? theme.colors.inverseText : theme.colors.subtleText}
                size={13}
              />
              <AppText style={{
                color: isHated ? theme.colors.inverseText : theme.colors.subtleText,
                fontFamily: theme.fonts.sansMedium,
                fontSize: 12,
              }}>
                Hate it
              </AppText>
            </Pressable>
          </View>

          {/* Sketch actions */}
          {hasSketch ? (
            <Pressable
              onPress={onGenerateSketch}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <AppIcon name="sparkles" color={theme.colors.accent} size={11} />
              <AppText style={{ color: theme.colors.accent, fontFamily: theme.fonts.sansMedium, fontSize: 11, letterSpacing: 0.4 }}>
                Redo sketch
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
