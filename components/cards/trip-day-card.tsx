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

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  day: TripOutfitDay;
  onGenerateSketch: () => void;
};

export function TripDayCard({ day, onGenerateSketch }: Props) {
  const { theme } = useTheme();

  const dayLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const hasSketch = day.sketchStatus === 'ready' && day.sketchUrl;
  const isLoading = day.sketchStatus === 'loading';
  const failed = day.sketchStatus === 'failed';
  const notStarted = day.sketchStatus === 'not_started';

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 24,
        borderWidth: 1,
        overflow: 'hidden',
      }}>

      {/* ── Sketch image ─────────────────────────────────────────────────── */}
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
          {isLoading ? (
            <>
              <ActivityIndicator color={theme.colors.accent} size="large" />
              <AppText style={{ color: theme.colors.mutedText, fontSize: 12 }}>
                Generating sketch…
              </AppText>
            </>
          ) : (
            <>
              <AppIcon name="sparkles" color={theme.colors.subtleText} size={28} />
              <AppText style={{ color: theme.colors.mutedText, fontSize: 13, textAlign: 'center', paddingHorizontal: spacing.lg }}>
                {failed ? 'Sketch failed. Try again.' : 'No sketch yet'}
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
                  {failed ? 'Retry Sketch' : 'Generate Sketch'}
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

        {/* Outfit pieces */}
        <View style={{ gap: spacing.xs }}>
          <AppText style={{ color: theme.colors.mutedText, fontFamily: theme.fonts.sansMedium, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Outfit
          </AppText>
          {day.pieces.map((piece, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs }}>
              <AppText style={{ color: theme.colors.accent, fontSize: 13, lineHeight: 20 }}>·</AppText>
              <AppText style={{ flex: 1, fontSize: 13, lineHeight: 20 }}>{piece}</AppText>
            </View>
          ))}
          {/* Shoes */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs }}>
            <AppText style={{ color: theme.colors.accent, fontSize: 13, lineHeight: 20 }}>·</AppText>
            <AppText style={{ flex: 1, fontSize: 13, lineHeight: 20 }}>{day.shoes} <AppText style={{ color: theme.colors.subtleText, fontSize: 11 }}>(shoes)</AppText></AppText>
          </View>
          {/* Bag */}
          {day.bag ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs }}>
              <AppText style={{ color: theme.colors.accent, fontSize: 13, lineHeight: 20 }}>·</AppText>
              <AppText style={{ flex: 1, fontSize: 13, lineHeight: 20 }}>{day.bag} <AppText style={{ color: theme.colors.subtleText, fontSize: 11 }}>(bag)</AppText></AppText>
            </View>
          ) : null}
          {/* Accessories */}
          {day.accessories.map((acc, i) => (
            <View key={`acc-${i}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs }}>
              <AppText style={{ color: theme.colors.accent, fontSize: 13, lineHeight: 20 }}>·</AppText>
              <AppText style={{ flex: 1, fontSize: 13, lineHeight: 20 }}>{acc}</AppText>
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

        {/* Sketch button — only shown when sketch is ready (to allow re-generation) */}
        {hasSketch && (
          <Pressable
            onPress={onGenerateSketch}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}>
            <AppIcon name="sparkles" color={theme.colors.accent} size={11} />
            <AppText style={{ color: theme.colors.accent, fontFamily: theme.fonts.sansMedium, fontSize: 11, letterSpacing: 0.4 }}>
              Regenerate Sketch
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );
}
