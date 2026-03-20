import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { RemoteImagePanel } from '@/components/ui/remote-image-panel';
import { SectionHeader } from '@/components/ui/section-header';
import { spacing, theme } from '@/constants/theme';
import { getNextSevenDays, loadWeekPlan } from '@/lib/week-plan-storage';
import { loadNextSevenDayForecast, type WeekForecastDay } from '@/services/weather/current-weather-service';
import type { WeekPlannedOutfit } from '@/types/style';

type WeekPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelectDay: (dayKey: string, dayLabel: string) => void;
};

export function WeekPickerModal({ visible, onClose, onSelectDay }: WeekPickerModalProps) {
  const days = getNextSevenDays();
  const [assignedDays, setAssignedDays] = useState<WeekPlannedOutfit[]>([]);
  const [replacementCandidate, setReplacementCandidate] = useState<WeekPlannedOutfit | null>(null);
  const [forecastByDay, setForecastByDay] = useState<Record<string, WeekForecastDay>>({});

  useEffect(() => {
    let isMounted = true;

    async function hydrateModal() {
      const [items, forecast] = await Promise.all([
        loadWeekPlan(),
        loadNextSevenDayForecast().catch(() => [] as WeekForecastDay[]),
      ]);

      if (!isMounted) {
        return;
      }

      setAssignedDays(items);
      setForecastByDay(
        Object.fromEntries(forecast.map((day) => [day.dayKey, day]))
      );
    }

    if (visible) {
      void hydrateModal();
      setReplacementCandidate(null);
    }

    return () => {
      isMounted = false;
    };
  }, [visible]);

  const activeAssignment = replacementCandidate
    ? assignedDays.find((item) => item.dayKey === replacementCandidate.dayKey) ?? replacementCandidate
    : null;

  function handleDayPress(dayKey: string, dayLabel: string) {
    const existingAssignment = assignedDays.find((item) => item.dayKey === dayKey);

    if (existingAssignment) {
      setReplacementCandidate(existingAssignment);
      return;
    }

    onSelectDay(dayKey, dayLabel);
  }

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          alignItems: 'center',
          backgroundColor: 'rgba(26, 22, 20, 0.4)',
          flex: 1,
          justifyContent: 'flex-end',
          padding: spacing.lg,
        }}>
        <Pressable
          onPress={() => undefined}
          style={[
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.xl,
              gap: spacing.lg,
              maxWidth: 420,
              padding: spacing.lg,
              width: '100%',
            },
            theme.shadows.lg,
          ]}>
          {activeAssignment ? (
            <View style={{ gap: spacing.lg }}>
              <SectionHeader
                eyebrow="Confirmation"
                title="Replace Outfit?"
                subtitle="This day already has a planned outfit."
              />
              <View
                style={[
                  {
                    backgroundColor: theme.colors.background,
                    borderRadius: theme.radius.lg,
                    gap: spacing.md,
                    padding: spacing.md,
                  },
                ]}>
                <AppText variant="sectionTitle">{activeAssignment.dayLabel}</AppText>
                {activeAssignment.recommendation.sketchImageUrl ? (
                  <RemoteImagePanel
                    uri={activeAssignment.recommendation.sketchImageUrl}
                    aspectRatio={4 / 5}
                    minHeight={180}
                    fallbackTitle="Sketch unavailable"
                    fallbackMessage="The assigned illustration could not be displayed."
                  />
                ) : null}
                <View style={{ gap: spacing.xs }}>
                  <AppText variant="sectionTitle">{activeAssignment.recommendation.title}</AppText>
                  <AppText tone="muted">{formatTierLabel(activeAssignment.recommendation.tier)}</AppText>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <PrimaryButton
                  label="No"
                  onPress={() => setReplacementCandidate(null)}
                  style={{ flex: 1 }}
                  variant="secondary"
                />
                <PrimaryButton
                  label="Yes"
                  onPress={() => onSelectDay(activeAssignment.dayKey, activeAssignment.dayLabel)}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ) : (
            <>
              <SectionHeader 
                eyebrow="Week Planner"
                title="Add to Week" 
                subtitle="Choose a day for this outfit."
              />
              <View style={{ gap: spacing.sm }}>
                {days.map((day) => {
                  const existingAssignment = assignedDays.find((item) => item.dayKey === day.dayKey);
                  const isAssigned = Boolean(existingAssignment);
                  const forecast = forecastByDay[day.dayKey];

                  return (
                    <Pressable
                      key={day.dayKey}
                      onPress={() => handleDayPress(day.dayKey, day.dayLabel)}
                      style={({ pressed }) => [
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: isAssigned ? theme.colors.accentLight : theme.colors.background,
                          borderRadius: theme.radius.md,
                          minHeight: 56,
                          paddingHorizontal: spacing.md,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                        <View 
                          style={{ 
                            width: 40, 
                            height: 40, 
                            borderRadius: theme.radius.sm,
                            backgroundColor: isAssigned ? theme.colors.accent : theme.colors.borderSubtle,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                          <Ionicons
                            color={isAssigned ? theme.colors.surface : theme.colors.subtleText}
                            name={isAssigned ? 'checkmark' : 'calendar-outline'}
                            size={18}
                          />
                        </View>
                        <View>
                          <AppText variant="sectionTitle">{day.dayLabel}</AppText>
                          <AppText variant="caption" tone={isAssigned ? 'accent' : 'subtle'}>
                            {isAssigned ? 'Has outfit' : 'Available'}
                          </AppText>
                        </View>
                      </View>
                      {forecast && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                          <Ionicons color={theme.colors.subtleText} name={weatherIconName(forecast.weatherCode)} size={16} />
                          <AppText variant="caption" tone="muted">{`${Math.round(forecast.highTempC)}°`}</AppText>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
              <PrimaryButton label="Cancel" onPress={onClose} variant="ghost" />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function formatTierLabel(tier: WeekPlannedOutfit['recommendation']['tier']) {
  if (tier === 'smart-casual') {
    return 'Smart Casual';
  }

  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function weatherIconName(code: number): React.ComponentProps<typeof Ionicons>['name'] {
  if (code === 0) return 'sunny-outline';
  if ([1, 2, 3].includes(code)) return 'partly-sunny-outline';
  if ([45, 48].includes(code)) return 'cloud-outline';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rainy-outline';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow-outline';
  if ([95, 96, 99].includes(code)) return 'thunderstorm-outline';
  return 'cloud-outline';
}
