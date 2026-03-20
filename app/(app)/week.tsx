import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { Link } from 'expo-router';

import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/ui/section-header';
import { useToast } from '@/components/ui/toast-provider';
import { RemoteImagePanel } from '@/components/ui/remote-image-panel';
import { spacing, theme } from '@/constants/theme';
import { buildTierHref } from '@/lib/look-route';
import { getNextSevenDays, loadWeekPlan, removeWeekPlan } from '@/lib/week-plan-storage';
import { buildSavedOutfitId, loadSavedOutfits, saveSavedOutfit } from '@/lib/saved-outfits-storage';
import type { WeekPlannedOutfit } from '@/types/style';

export default function WeekScreen() {
  const [items, setItems] = useState<WeekPlannedOutfit[]>([]);
  const [savedOutfitIds, setSavedOutfitIds] = useState<string[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const isFocused = useIsFocused();
  const { showToast } = useToast();

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      const [nextItems, savedOutfits] = await Promise.all([loadWeekPlan(), loadSavedOutfits()]);
      if (isMounted) {
        setItems(nextItems);
        setSavedOutfitIds(savedOutfits.map((item) => item.id));
      }
    }

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, [isFocused]);

  const days = getNextSevenDays();

  async function handleSave(assignment: WeekPlannedOutfit) {
    const savedId = buildSavedOutfitId(assignment.requestId, assignment.recommendation.tier);
    if (savedOutfitIds.includes(savedId)) {
      return;
    }

    setSavingId(savedId);

    try {
      await saveSavedOutfit(assignment.input, assignment.recommendation, assignment.requestId);
      setSavedOutfitIds((current) => [...current, savedId]);
      showToast('Outfit saved to favorites.');
    } catch {
      showToast('Could not save this outfit.', 'error');
    }

    setSavingId(null);
  }

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl }}>
        <SectionHeader 
          eyebrow="Planning"
          title="Your Week"
          subtitle="Plan your outfits for the next 7 days."
          variant="page"
        />
        {days.map((day) => {
          const assignment = items.find((item) => item.dayKey === day.dayKey);

          if (!assignment) {
            return (
              <View
                key={day.dayKey}
                style={[
                  {
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radius.lg,
                    padding: spacing.lg,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                  },
                  theme.shadows.sm,
                ]}>
                <View 
                  style={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.borderSubtle,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Ionicons name="calendar-outline" size={22} color={theme.colors.subtleText} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="sectionTitle">{day.dayLabel}</AppText>
                  <AppText variant="caption" tone="subtle">No outfit planned</AppText>
                </View>
                <Ionicons name="add-circle-outline" size={24} color={theme.colors.subtleText} />
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
                style={({ pressed }) => [
                  {
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radius.lg,
                    overflow: 'hidden',
                    opacity: pressed ? 0.95 : 1,
                  },
                  theme.shadows.md,
                ]}>
                {/* Header */}
                <View 
                  style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: spacing.lg,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.borderSubtle,
                  }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View 
                      style={{ 
                        width: 40, 
                        height: 40, 
                        borderRadius: theme.radius.sm,
                        backgroundColor: theme.colors.accentLight,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Ionicons name="calendar" size={18} color={theme.colors.accent} />
                    </View>
                    <View>
                      <AppText variant="sectionTitle">{day.dayLabel}</AppText>
                      <AppText variant="meta" tone="accent">{formatTierLabel(assignment.recommendation.tier)}</AppText>
                    </View>
                  </View>
                  <Pressable
                    hitSlop={12}
                    onPress={async (event) => {
                      event.stopPropagation();
                      setItems(await removeWeekPlan(day.dayKey));
                    }}
                    style={({ pressed }) => ({
                      width: 32,
                      height: 32,
                      borderRadius: theme.radius.full,
                      backgroundColor: pressed ? theme.colors.dangerLight : theme.colors.borderSubtle,
                      alignItems: 'center',
                      justifyContent: 'center',
                    })}>
                    <Ionicons color={theme.colors.danger} name="close" size={18} />
                  </Pressable>
                </View>
                
                {/* Image */}
                {assignment.recommendation.sketchImageUrl && (
                  <View style={{ padding: spacing.md }}>
                    <RemoteImagePanel
                      uri={assignment.recommendation.sketchImageUrl}
                      aspectRatio={4 / 5}
                      minHeight={200}
                      fallbackTitle="Sketch unavailable"
                      fallbackMessage="The planned illustration could not be displayed."
                    />
                  </View>
                )}
                
                {/* Footer */}
                <View style={{ padding: spacing.lg, gap: spacing.md }}>
                  <AppText variant="title">{assignment.recommendation.title}</AppText>
                  
                  <Pressable
                    disabled={savedOutfitIds.includes(buildSavedOutfitId(assignment.requestId, assignment.recommendation.tier))}
                    onPress={(event) => {
                      event.stopPropagation();
                      void handleSave(assignment);
                    }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: spacing.xs,
                      minHeight: 48,
                      borderRadius: theme.radius.full,
                      backgroundColor: savedOutfitIds.includes(buildSavedOutfitId(assignment.requestId, assignment.recommendation.tier))
                        ? theme.colors.successLight
                        : theme.colors.accentLight,
                      opacity: pressed ? 0.8 : 1,
                    })}>
                    <Ionicons
                      color={savedOutfitIds.includes(buildSavedOutfitId(assignment.requestId, assignment.recommendation.tier)) 
                        ? theme.colors.success 
                        : theme.colors.accent}
                      name={savedOutfitIds.includes(buildSavedOutfitId(assignment.requestId, assignment.recommendation.tier)) ? 'checkmark-circle' : 'heart-outline'}
                      size={18}
                    />
                    <AppText 
                      variant="meta"
                      style={{ 
                        color: savedOutfitIds.includes(buildSavedOutfitId(assignment.requestId, assignment.recommendation.tier)) 
                          ? theme.colors.success 
                          : theme.colors.accent 
                      }}>
                      {savedOutfitIds.includes(buildSavedOutfitId(assignment.requestId, assignment.recommendation.tier))
                        ? 'Saved'
                        : savingId === buildSavedOutfitId(assignment.requestId, assignment.recommendation.tier)
                          ? 'Saving...'
                          : 'Save to Favorites'}
                    </AppText>
                  </Pressable>
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
