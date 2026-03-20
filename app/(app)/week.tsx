import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { Link } from 'expo-router';

import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/ui/section-header';
import { RemoteImagePanel } from '@/components/ui/remote-image-panel';
import { spacing, theme } from '@/constants/theme';
import { buildTierHref } from '@/lib/look-route';
import { getNextSevenDays, loadWeekPlan, removeWeekPlan } from '@/lib/week-plan-storage';
import type { WeekPlannedOutfit } from '@/types/style';

export default function WeekScreen() {
  const [items, setItems] = useState<WeekPlannedOutfit[]>([]);
  const isFocused = useIsFocused();

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      const nextItems = await loadWeekPlan();
      if (isMounted) {
        setItems(nextItems);
      }
    }

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, [isFocused]);

  const days = getNextSevenDays();

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.lg }}>
        <SectionHeader title="Week" subtitle="Plan your next 7 days of outfits." />
        {days.map((day) => {
          const assignment = items.find((item) => item.dayKey === day.dayKey);

          if (!assignment) {
            return (
              <View
                key={day.dayKey}
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: 28,
                  borderWidth: 1,
                  gap: spacing.xs,
                  padding: spacing.lg,
                }}>
                <AppText variant="sectionTitle">{day.dayLabel}</AppText>
                <AppText tone="muted">Nothing planned yet.</AppText>
              </View>
            );
          }

          return (
            <Link
              key={day.dayKey}
              href={buildTierHref(
                assignment.recommendation.tier,
                assignment.requestId,
                assignment.input,
                assignment.recommendation,
                0
              )}
              asChild>
              <Pressable
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: 28,
                  borderWidth: 1,
                  gap: spacing.md,
                  padding: spacing.lg,
                }}>
                <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText variant="sectionTitle">{day.dayLabel}</AppText>
                  <Pressable
                    hitSlop={8}
                    onPress={async (event) => {
                      event.stopPropagation();
                      setItems(await removeWeekPlan(day.dayKey));
                    }}>
                    <Ionicons color={theme.colors.danger} name="close" size={20} />
                  </Pressable>
                </View>
                {assignment.recommendation.sketchImageUrl ? (
                  <RemoteImagePanel
                    uri={assignment.recommendation.sketchImageUrl}
                    aspectRatio={4 / 5}
                    minHeight={220}
                    fallbackTitle="Sketch unavailable"
                    fallbackMessage="The planned illustration could not be displayed."
                  />
                ) : null}
                <View style={{ gap: spacing.xs }}>
                  <AppText variant="title">{assignment.recommendation.title}</AppText>
                  <AppText tone="muted">{formatTierLabel(assignment.recommendation.tier)}</AppText>
                </View>
              </Pressable>
            </Link>
          );
        })}
        {!items.length ? (
          <EmptyState
            title="No week planned yet"
            message="Add outfits from the result page to assign them to the next 7 days."
            actionLabel="Create a look"
            actionHref="/(app)/create-look"
          />
        ) : null}
      </View>
    </AppScreen>
  );
}

function formatTierLabel(tier: WeekPlannedOutfit['recommendation']['tier']) {
  if (tier === 'smart-casual') {
    return 'Smart Casual';
  }

  return tier.charAt(0).toUpperCase() + tier.slice(1);
}
