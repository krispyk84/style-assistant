import { ActivityIndicator, Image, Pressable, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { TripOutfitDay } from '@/services/trip-outfits';

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

  for (const piece of day.pieces) {
    const cat = categorizePiece(piece);
    (groupMap[cat] ??= []).push(piece);
  }

  const groups: OutfitGroup[] = [];
  for (const label of ['Swimwear', 'Outerwear', 'Dress / Jumpsuit', 'Top', 'Bottom']) {
    if (groupMap[label]?.length) groups.push({ label, items: groupMap[label]! });
  }

  groups.push({ label: 'Shoes', items: [day.shoes] });
  if (day.bag) groups.push({ label: 'Bag', items: [day.bag] });
  if (day.accessories.length) groups.push({ label: 'Accessories', items: day.accessories });

  return groups;
}

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  day: TripOutfitDay;
  isRegenerating: boolean;
  onGenerateSketch: () => void;
  onLove: () => void;
  onHate: () => void;
};

export function TripDayCard({ day, isRegenerating, onGenerateSketch, onLove, onHate }: Props) {
  const { theme } = useTheme();

  const dayLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const hasSketch = day.sketchStatus === 'ready' && day.sketchUrl;
  const isSketchLoading = day.sketchStatus === 'loading';
  const sketchFailed = day.sketchStatus === 'failed';

  const isLoved = day.feedback === 'love';
  const isHated = day.feedback === 'hate';

  const outfitGroups = buildOutfitGroups(day);

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 24,
        borderWidth: 1,
        overflow: 'hidden',
        opacity: isRegenerating ? 0.5 : 1,
      }}>

      {/* ── Sketch / Placeholder ─────────────────────────────────────────── */}
      {hasSketch ? (
        <Image
          source={{ uri: day.sketchUrl }}
          style={{ width: '100%', aspectRatio: 1024 / 1536 }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width: '100%',
            aspectRatio: 1024 / 1536,
            backgroundColor: theme.colors.subtleSurface,
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
          }}>
          {isSketchLoading ? (
            <>
              <ActivityIndicator color={theme.colors.accent} size="large" />
              <AppText style={{ color: theme.colors.mutedText, fontSize: 12 }}>
                Generating sketch…
              </AppText>
            </>
          ) : isRegenerating ? (
            <>
              <ActivityIndicator color={theme.colors.accent} size="large" />
              <AppText style={{ color: theme.colors.mutedText, fontSize: 12 }}>
                Finding a new outfit…
              </AppText>
            </>
          ) : (
            <>
              <AppIcon name="sparkles" color={theme.colors.subtleText} size={28} />
              <AppText style={{ color: theme.colors.mutedText, fontSize: 13, textAlign: 'center', paddingHorizontal: spacing.lg }}>
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
            </>
          )}
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
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Context tags */}
        {day.contextTags.length > 0 && (
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
